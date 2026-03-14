import { useEffect, useState } from 'react'
import { Search, Filter, Download, ArrowUpRight, ArrowDownRight, Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { api } from '../services/api'

export default function Hareketler() {
  const [data, setData] = useState({ toplam: 0, hareketler: [] })
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    baslangic: '', bitis: '', islem_turu: '', arama: ''
  })
  const [page, setPage] = useState(0)
  const limit = 25

  const loadData = () => {
    setLoading(true)
    const params = { limit, offset: page * limit }
    if (filters.baslangic) params.baslangic = filters.baslangic
    if (filters.bitis) params.bitis = filters.bitis
    if (filters.islem_turu) params.islem_turu = filters.islem_turu
    if (filters.arama) params.arama = filters.arama

    api.getTumHareketler(params)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [page])

  const handleFilter = (e) => {
    e.preventDefault()
    setPage(0)
    loadData()
  }

  const totalPages = Math.ceil(data.toplam / limit)

  // Xülasə hesabla
  const medaxil = data.hareketler.filter(h => h.islem_turu === 'medaxil' || h.mebleg > 0).reduce((s, h) => s + Math.abs(h.mebleg), 0)
  const mexaric = data.hareketler.filter(h => h.islem_turu === 'mexaric' || h.mebleg < 0).reduce((s, h) => s + Math.abs(h.mebleg), 0)

  return (
    <div className="space-y-6">
      {/* Filter Panel */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Əməliyyatlar</h2>
        <form onSubmit={handleFilter} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Başlanğıc</label>
            <input
              type="date" value={filters.baslangic}
              onChange={e => setFilters({...filters, baslangic: e.target.value})}
              className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Bitmə</label>
            <input
              type="date" value={filters.bitis}
              onChange={e => setFilters({...filters, bitis: e.target.value})}
              className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Növ</label>
            <select
              value={filters.islem_turu}
              onChange={e => setFilters({...filters, islem_turu: e.target.value})}
              className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">Hamısı</option>
              <option value="medaxil">Mədaxil</option>
              <option value="mexaric">Məxaric</option>
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-gray-500 block mb-1">Axtarış</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text" placeholder="Təyinat, hesab, sənəd..."
                value={filters.arama}
                onChange={e => setFilters({...filters, arama: e.target.value})}
                className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm flex items-center gap-1">
            <Filter className="w-4 h-4" /> Axtar
          </button>
        </form>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-2 mb-1">
            <ArrowUpRight className="w-4 h-4 text-green-500" />
            <span className="text-sm text-gray-500">Səhifədəki Mədaxil</span>
          </div>
          <span className="text-xl font-bold text-green-600">₼{medaxil.toLocaleString('az-AZ', { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-2 mb-1">
            <ArrowDownRight className="w-4 h-4 text-red-500" />
            <span className="text-sm text-gray-500">Səhifədəki Məxaric</span>
          </div>
          <span className="text-xl font-bold text-red-600">₼{mexaric.toLocaleString('az-AZ', { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-4 h-4 text-blue-500" />
            <span className="text-sm text-gray-500">Toplam Əməliyyat</span>
          </div>
          <span className="text-xl font-bold text-gray-900">{data.toplam}</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tarix</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Növ</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Təyinat</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Əks Hesab</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Məbləğ</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qalıq</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan="6" className="px-4 py-8 text-center text-gray-500">Yüklənir...</td></tr>
              ) : data.hareketler.length === 0 ? (
                <tr><td colSpan="6" className="px-4 py-8 text-center text-gray-500">Əməliyyat tapılmadı</td></tr>
              ) : (
                data.hareketler.map((h) => {
                  const isMedaxil = h.islem_turu === 'medaxil' || h.mebleg > 0
                  return (
                    <tr key={h.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                        {new Date(h.tarixi).toLocaleDateString('az-AZ')}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full font-medium ${
                          isMedaxil ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {isMedaxil
                            ? <><ArrowUpRight className="w-3 h-3" /> Mədaxil</>
                            : <><ArrowDownRight className="w-3 h-3" /> Məxaric</>
                          }
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{h.teyinat || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{h.acs_hesap || '-'}</td>
                      <td className={`px-4 py-3 text-sm text-right font-semibold ${
                        isMedaxil ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {isMedaxil ? '+' : '-'}₼{Math.abs(h.mebleg).toLocaleString('az-AZ', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">
                        {h.bakiye != null ? `₼${Number(h.bakiye).toLocaleString('az-AZ', { minimumFractionDigits: 2 })}` : '-'}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <span className="text-sm text-gray-500">
              {page * limit + 1}-{Math.min((page + 1) * limit, data.toplam)} / {data.toplam}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm text-gray-700">Səhifə {page + 1} / {totalPages}</span>
              <button
                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1}
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
