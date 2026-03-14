import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, Wallet, Activity, Download, Upload, ArrowUpRight, ArrowDownRight, Building2 } from 'lucide-react'
import { api } from '../services/api'

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [hesaplar, setHesaplar] = useState([])
  const [rapor, setRapor] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.getOzet().catch(() => null),
      api.getHesaplar().catch(() => []),
      api.getDetayliRapor({ rapor_turu: 'aylik' }).catch(() => null),
    ]).then(([ozet, hesap, rap]) => {
      setData(ozet)
      setHesaplar(hesap)
      setRapor(rap)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-8 text-center text-gray-500">Yüklənir...</div>

  const statCards = data ? [
    { title: 'Cari Qalıq', value: data.cari_qaliq, icon: Wallet, color: 'blue', prefix: '₼' },
    { title: 'Toplam Mədaxil', value: data.toplam_medaxil, icon: TrendingUp, color: 'green', prefix: '₼' },
    { title: 'Toplam Məxaric', value: data.toplam_mexaric, icon: TrendingDown, color: 'red', prefix: '₼' },
    { title: 'Günlük Əməliyyat', value: data.gunluk_hareketler?.length || 0, icon: Activity, color: 'purple', prefix: '' },
  ] : []

  const colorClasses = {
    blue: { bg: 'bg-blue-50', border: 'border-blue-100', icon: 'text-blue-500' },
    green: { bg: 'bg-green-50', border: 'border-green-100', icon: 'text-green-500' },
    red: { bg: 'bg-red-50', border: 'border-red-100', icon: 'text-red-500' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-100', icon: 'text-purple-500' },
  }

  // Aylıq chart üçün max dəyər
  const maxChartVal = rapor ? Math.max(...rapor.donemler.map(d => Math.max(d.medaxil, d.mexaric)), 1) : 1

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      {data && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Ümumi Məlumat</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map((card) => {
              const c = colorClasses[card.color]
              return (
                <div key={card.title} className={`p-4 rounded-lg ${c.bg} border ${c.border}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">{card.title}</span>
                    <card.icon className={`w-5 h-5 ${c.icon}`} />
                  </div>
                  <div className="text-2xl font-bold text-gray-900">
                    {card.prefix}{Number(card.value).toLocaleString('az-AZ', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Monthly Trend Chart */}
      {rapor && rapor.donemler.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Aylıq Trend</h2>
          <div className="space-y-2">
            {rapor.donemler.slice(0, 6).map((d) => {
              const [y, m] = d.donem.split('-')
              const months = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'İyn', 'İyl', 'Avq', 'Sen', 'Okt', 'Noy', 'Dek']
              const label = `${months[parseInt(m) - 1]} ${y}`
              return (
                <div key={d.donem} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-16 shrink-0">{label}</span>
                  <div className="flex-1 flex h-6 gap-0.5">
                    <div
                      className="bg-green-400 rounded-sm h-full transition-all"
                      style={{ width: `${(d.medaxil / maxChartVal) * 100}%` }}
                    />
                    <div
                      className="bg-red-400 rounded-sm h-full transition-all"
                      style={{ width: `${(d.mexaric / maxChartVal) * 100}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-400 w-24 text-right shrink-0">
                    <span className="text-green-600">+₼{(d.medaxil / 1000).toFixed(1)}k</span>{' '}
                    <span className="text-red-600">-₼{(d.mexaric / 1000).toFixed(1)}k</span>
                  </div>
                </div>
              )
            })}
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-400 rounded-sm inline-block"></span> Mədaxil</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-400 rounded-sm inline-block"></span> Məxaric</span>
            </div>
          </div>
        </div>
      )}

      {/* Hesablar Xülasəsi */}
      {hesaplar.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Banka Hesabları</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {hesaplar.map((h) => (
              <div key={h.id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-gray-50">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{h.sirket_adi}</p>
                  <p className="text-xs text-gray-500">{h.banka_adi} - {h.valyuta}</p>
                </div>
                {h.kapanis_bakiye != null && (
                  <span className="text-sm font-bold text-gray-900">
                    ₼{Number(h.kapanis_bakiye).toLocaleString('az-AZ', { minimumFractionDigits: 2 })}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bugünkü Əməliyyatlar */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Bugünkü Əməliyyatlar</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Tarix</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Növ</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Təyinat</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Məbləğ</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Qalıq</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(!data || !data.gunluk_hareketler || data.gunluk_hareketler.length === 0) ? (
                <tr>
                  <td colSpan="5" className="px-4 py-8 text-center text-gray-400">
                    Bugün üçün əməliyyat yoxdur
                  </td>
                </tr>
              ) : (
                data.gunluk_hareketler.slice(0, 15).map((h) => {
                  const isMedaxil = h.islem_turu === 'medaxil' || h.mebleg > 0
                  return (
                    <tr key={h.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">{new Date(h.tarixi).toLocaleString('az-AZ')}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full font-medium ${
                          isMedaxil ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {isMedaxil ? <><ArrowUpRight className="w-3 h-3" /> Mədaxil</> : <><ArrowDownRight className="w-3 h-3" /> Məxaric</>}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 truncate max-w-md">{h.teyinat || '-'}</td>
                      <td className={`px-4 py-3 text-sm text-right font-medium ${
                        isMedaxil ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {isMedaxil ? '+' : '-'}₼{Number(Math.abs(h.mebleg)).toLocaleString('az-AZ', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">
                        ₼{Number(h.bakiye || 0).toLocaleString('az-AZ', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
