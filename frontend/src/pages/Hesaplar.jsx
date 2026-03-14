import { useEffect, useState } from 'react'
import { Plus, Trash2, Building2, CreditCard, Upload, FileSpreadsheet, FileText, X, Eye } from 'lucide-react'
import { api } from '../services/api'

export default function Hesaplar() {
  const [hesaplar, setHesaplar] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showUpload, setShowUpload] = useState(null)
  const [uploadResult, setUploadResult] = useState(null)
  const [form, setForm] = useState({
    sirket_adi: '', banka_adi: '', iban: '', valyuta: 'AZN', voen: ''
  })

  const loadHesaplar = () => {
    setLoading(true)
    api.getHesaplar()
      .then(setHesaplar)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadHesaplar() }, [])

  const handleSubmit = (e) => {
    e.preventDefault()
    api.createHesap(form)
      .then(() => {
        setShowForm(false)
        setForm({ sirket_adi: '', banka_adi: '', iban: '', valyuta: 'AZN', voen: '' })
        loadHesaplar()
      })
      .catch(console.error)
  }

  const handleDelete = (id) => {
    if (!confirm('Bu hesabı silmək istədiyinizdən əminsiniz?')) return
    api.deleteHesap(id)
      .then(loadHesaplar)
      .catch(console.error)
  }

  const handleFileUpload = async (hesapId, file) => {
    setUploadResult(null)
    try {
      let result
      if (file.name.endsWith('.pdf')) {
        result = await api.uploadPDF(hesapId, file)
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        result = await api.uploadExcel(hesapId, file)
      } else {
        alert('Yalnız PDF və Excel faylları dəstəklənir')
        return
      }
      setUploadResult(result)
      loadHesaplar()
    } catch (err) {
      alert('Fayl yüklənərkən xəta baş verdi: ' + err.message)
    }
  }

  if (loading) return <div className="p-8 text-center text-gray-500">Yüklənir...</div>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Banka Hesabları</h2>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Yeni Hesab
          </button>
        </div>

        {/* Yeni Hesab Formu */}
        {showForm && (
          <form onSubmit={handleSubmit} className="bg-gray-50 rounded-lg p-4 mb-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <input
                type="text" placeholder="Şirkət adı *" required
                value={form.sirket_adi} onChange={e => setForm({...form, sirket_adi: e.target.value})}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
              <input
                type="text" placeholder="Banka adı *" required
                value={form.banka_adi} onChange={e => setForm({...form, banka_adi: e.target.value})}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
              <input
                type="text" placeholder="IBAN *" required
                value={form.iban} onChange={e => setForm({...form, iban: e.target.value})}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
              <input
                type="text" placeholder="VÖEN"
                value={form.voen} onChange={e => setForm({...form, voen: e.target.value})}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
              <select
                value={form.valyuta} onChange={e => setForm({...form, valyuta: e.target.value})}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                <option value="AZN">AZN</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                Əlavə et
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400">
                Ləğv et
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Hesab Kartları */}
      {hesaplar.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Heç bir hesab tapılmadı</p>
          <p className="text-sm text-gray-400 mt-1">Yeni hesab əlavə edin və ya PDF/Excel faylı yükləyin</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {hesaplar.map((h) => (
            <div key={h.id} className="bg-white rounded-xl shadow-sm border p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{h.sirket_adi}</h3>
                    <p className="text-sm text-gray-500">{h.banka_adi}</p>
                  </div>
                </div>
                <button onClick={() => handleDelete(h.id)} className="text-red-400 hover:text-red-600 p-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">IBAN:</span>
                  <span className="text-gray-900 font-mono text-xs">{h.iban}</span>
                </div>
                {h.voen && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">VÖEN:</span>
                    <span className="text-gray-900">{h.voen}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Valyuta:</span>
                  <span className="text-gray-900 font-medium">{h.valyuta}</span>
                </div>
                {h.kapanis_bakiye != null && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Qalıq:</span>
                    <span className="text-gray-900 font-bold">
                      ₼{Number(h.kapanis_bakiye).toLocaleString('az-AZ', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
              </div>

              {/* Upload */}
              <div className="mt-4 pt-3 border-t flex gap-2">
                <button
                  onClick={() => setShowUpload(showUpload === h.id ? null : h.id)}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <Upload className="w-3 h-3" />
                  Fayl yüklə
                </button>
              </div>

              {showUpload === h.id && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-600 mb-2">PDF və ya Excel fayl seçin:</p>
                  <input
                    type="file"
                    accept=".pdf,.xlsx,.xls"
                    onChange={(e) => e.target.files[0] && handleFileUpload(h.id, e.target.files[0])}
                    className="text-sm w-full"
                  />
                  {uploadResult && (
                    <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-700">
                      {uploadResult.message}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
