import { useEffect, useState } from 'react'
import { BarChart3, TrendingUp, TrendingDown, Calendar, DollarSign, PieChart, ChevronDown, ChevronUp, FileSpreadsheet } from 'lucide-react'
import { api } from '../services/api'

const RAPOR_TURLERI = [
  { id: 'gunluk', label: 'Günlük', desc: 'Hər gün üçün ətraflı' },
  { id: 'aylik', label: 'Aylıq', desc: 'Ay üzrə qruplaşdırma' },
  { id: 'illik', label: 'İllik', desc: 'İl üzrə qruplaşdırma' },
]

export default function Raporlar() {
  const [raporTuru, setRaporTuru] = useState('aylik')
  const [hesaplar, setHesaplar] = useState([])
  const [selectedHesap, setSelectedHesap] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [expandedPeriod, setExpandedPeriod] = useState(null)
  const [baslangic, setBaslangic] = useState('')
  const [bitis, setBitis] = useState('')

  useEffect(() => {
    api.getHesaplar().then(setHesaplar).catch(console.error)
  }, [])

  const loadRapor = () => {
    setLoading(true)
    const params = { rapor_turu: raporTuru }
    if (selectedHesap) params.hesap_id = selectedHesap
    if (baslangic) params.baslangic = baslangic
    if (bitis) params.bitis = bitis

    api.getDetayliRapor(params)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadRapor() }, [raporTuru, selectedHesap])

  const formatMoney = (val) => `₼${Number(val).toLocaleString('az-AZ', { minimumFractionDigits: 2 })}`

  const formatPeriod = (donem) => {
    if (raporTuru === 'gunluk') {
      return new Date(donem).toLocaleDateString('az-AZ', { day: 'numeric', month: 'long', year: 'numeric' })
    } else if (raporTuru === 'aylik') {
      const [y, m] = donem.split('-')
      const months = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'İyun', 'İyul', 'Avqust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr']
      return `${months[parseInt(m) - 1]} ${y}`
    }
    return donem
  }

  // Barchar üçün max dəyər
  const maxVal = data ? Math.max(...data.donemler.map(d => Math.max(d.medaxil, d.mexaric)), 1) : 1

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Raporlar</h2>

        <div className="flex flex-wrap items-end gap-4">
          {/* Rapor türü seçimi */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            {RAPOR_TURLERI.map(t => (
              <button
                key={t.id}
                onClick={() => setRaporTuru(t.id)}
                className={`px-4 py-2 text-sm rounded-md transition-colors ${
                  raporTuru === t.id ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Hesab filteri */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">Hesab</label>
            <select
              value={selectedHesap}
              onChange={e => setSelectedHesap(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">Bütün hesablar</option>
              {hesaplar.map(h => (
                <option key={h.id} value={h.id}>{h.sirket_adi} - {h.banka_adi}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Başlanğıc</label>
            <input type="date" value={baslangic} onChange={e => setBaslangic(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Bitmə</label>
            <input type="date" value={bitis} onChange={e => setBitis(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <button onClick={loadRapor} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
            Yenilə
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-500">Yüklənir...</div>
      ) : !data ? (
        <div className="p-8 text-center text-gray-500">Məlumat yoxdur</div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl shadow-sm border p-5">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-green-500" />
                <span className="text-sm text-gray-500">Toplam Mədaxil</span>
              </div>
              <span className="text-2xl font-bold text-green-600">{formatMoney(data.toplam_medaxil)}</span>
            </div>
            <div className="bg-white rounded-xl shadow-sm border p-5">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="w-5 h-5 text-red-500" />
                <span className="text-sm text-gray-500">Toplam Məxaric</span>
              </div>
              <span className="text-2xl font-bold text-red-600">{formatMoney(data.toplam_mexaric)}</span>
            </div>
            <div className="bg-white rounded-xl shadow-sm border p-5">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-5 h-5 text-blue-500" />
                <span className="text-sm text-gray-500">Fərq (Net)</span>
              </div>
              <span className={`text-2xl font-bold ${data.fark >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {data.fark >= 0 ? '+' : ''}{formatMoney(data.fark)}
              </span>
            </div>
            <div className="bg-white rounded-xl shadow-sm border p-5">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-5 h-5 text-purple-500" />
                <span className="text-sm text-gray-500">Toplam Əməliyyat</span>
              </div>
              <span className="text-2xl font-bold text-gray-900">{data.toplam_emeliyyat}</span>
            </div>
          </div>

          {/* Visual Bar Chart */}
          {data.donemler.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Dövrlərin Müqayisəsi</h3>
              <div className="space-y-3">
                {data.donemler.slice(0, 12).map((d) => (
                  <div key={d.donem} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-28 shrink-0">{formatPeriod(d.donem)}</span>
                    <div className="flex-1 flex gap-1 items-center">
                      <div className="flex-1 flex h-5 gap-0.5">
                        <div
                          className="bg-green-400 rounded-sm h-full transition-all"
                          style={{ width: `${(d.medaxil / maxVal) * 100}%` }}
                          title={`Mədaxil: ${formatMoney(d.medaxil)}`}
                        />
                        <div
                          className="bg-red-400 rounded-sm h-full transition-all"
                          style={{ width: `${(d.mexaric / maxVal) * 100}%` }}
                          title={`Məxaric: ${formatMoney(d.mexaric)}`}
                        />
                      </div>
                      <span className="text-xs text-gray-400 w-8 text-right">{d.sayi}</span>
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-400 rounded-sm inline-block"></span> Mədaxil</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-400 rounded-sm inline-block"></span> Məxaric</span>
                </div>
              </div>
            </div>
          )}

          {/* Period Details (Expandable) */}
          <div className="bg-white rounded-xl shadow-sm border">
            <div className="p-4 border-b">
              <h3 className="text-sm font-semibold text-gray-700">Dövr Detalları</h3>
            </div>
            <div className="divide-y">
              {data.donemler.map((d) => (
                <div key={d.donem}>
                  <button
                    onClick={() => setExpandedPeriod(expandedPeriod === d.donem ? null : d.donem)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className="font-medium text-gray-900">{formatPeriod(d.donem)}</span>
                      <span className="text-xs text-gray-400">{d.sayi} əməliyyat</span>
                    </div>
                    <div className="flex items-center gap-6">
                      <span className="text-sm text-green-600 font-medium">+{formatMoney(d.medaxil)}</span>
                      <span className="text-sm text-red-600 font-medium">-{formatMoney(d.mexaric)}</span>
                      <span className={`text-sm font-bold ${d.medaxil - d.mexaric >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {formatMoney(d.medaxil - d.mexaric)}
                      </span>
                      {expandedPeriod === d.donem ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </div>
                  </button>

                  {expandedPeriod === d.donem && d.hareketler && (
                    <div className="px-4 pb-3 bg-gray-50">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs text-gray-500">
                            <th className="py-2 text-left">Tarix</th>
                            <th className="py-2 text-left">Növ</th>
                            <th className="py-2 text-left">Təyinat</th>
                            <th className="py-2 text-left">Əks Hesab</th>
                            <th className="py-2 text-right">Məbləğ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {d.hareketler.map((h) => {
                            const isMedaxil = h.islem_turu === 'medaxil' || h.mebleg > 0
                            return (
                              <tr key={h.id} className="hover:bg-white">
                                <td className="py-2 text-gray-700">{new Date(h.tarixi).toLocaleDateString('az-AZ')}</td>
                                <td className="py-2">
                                  <span className={`px-1.5 py-0.5 text-xs rounded ${isMedaxil ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {isMedaxil ? 'Mədaxil' : 'Məxaric'}
                                  </span>
                                </td>
                                <td className="py-2 text-gray-600 max-w-xs truncate">{h.teyinat || '-'}</td>
                                <td className="py-2 text-gray-600 max-w-xs truncate">{h.acs_hesap || '-'}</td>
                                <td className={`py-2 text-right font-medium ${isMedaxil ? 'text-green-600' : 'text-red-600'}`}>
                                  {isMedaxil ? '+' : '-'}₼{Math.abs(h.mebleg).toLocaleString('az-AZ', { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
              {data.donemler.length === 0 && (
                <div className="px-4 py-8 text-center text-gray-500">Bu dövr üçün məlumat yoxdur</div>
              )}
            </div>
          </div>

          {/* Category Breakdown */}
          {data.kategoriler && data.kategoriler.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <PieChart className="w-4 h-4" /> Kateqoriya / Əks Hesab üzrə Bölgü
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 border-b">
                      <th className="py-2 text-left">Kateqoriya</th>
                      <th className="py-2 text-right">Mədaxil</th>
                      <th className="py-2 text-right">Məxaric</th>
                      <th className="py-2 text-right">Sayı</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.kategoriler.slice(0, 20).map((k, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="py-2 text-gray-900 font-medium">{k.ad}</td>
                        <td className="py-2 text-right text-green-600">{k.medaxil > 0 ? formatMoney(k.medaxil) : '-'}</td>
                        <td className="py-2 text-right text-red-600">{k.mexaric > 0 ? formatMoney(k.mexaric) : '-'}</td>
                        <td className="py-2 text-right text-gray-500">{k.sayi}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
