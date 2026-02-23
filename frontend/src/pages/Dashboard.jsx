import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, Wallet, Activity, Download } from 'lucide-react'
import { api } from '../services/api'

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getOzet()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-8 text-center text-gray-500">Yüklənir...</div>
  if (!data) return <div className="p-8 text-center text-gray-500">Məlumat yoxdur</div>

  const statCards = [
    { title: 'Cari Qalıq', value: data.cari_qaliq, icon: Wallet, color: 'blue', prefix: '₼' },
    { title: 'Toplam Mədaxil', value: data.toplam_medaxil, icon: TrendingUp, color: 'green', prefix: '₼' },
    { title: 'Toplam Məxaric', value: data.toplam_mexaric, icon: TrendingDown, color: 'red', prefix: '₼' },
    { title: 'Günlük Əməliyyat', value: data.gunluk_hareketler.length, icon: Activity, color: 'purple', prefix: '' },
  ]

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Ümumi Məlumat</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((card) => (
            <div key={card.title} className={`p-4 rounded-lg bg-${card.color}-50 border border-${card.color}-100`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">{card.title}</span>
                <card.icon className={`w-5 h-5 text-${card.color}-500`} />
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {card.prefix}{Number(card.value).toLocaleString('az-AZ', { minimumFractionDigits: 2 })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Bugünkü Əməliyyatlar</h2>
          <button className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700">
            <Download className="w-4 h-4" />
            Excel
          </button>
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
              {data.gunluk_hareketler.slice(0, 10).map((h) => (
                <tr key={h.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">{new Date(h.tarixi).toLocaleString('az-AZ')}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      h.mebleg > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {h.islem_turu}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 truncate max-w-md">{h.teyinat || '-'}</td>
                  <td className={`px-4 py-3 text-sm text-right font-medium ${
                    h.mebleg > 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    ₼{Number(Math.abs(h.mebleg)).toLocaleString('az-AZ', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900">
                    ₼{Number(h.bakiye || 0).toLocaleString('az-AZ', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
