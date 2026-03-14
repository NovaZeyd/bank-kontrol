import { useEffect, useState } from 'react'
import { Users, Plus, Mail, Phone, UserCircle, Star } from 'lucide-react'
import { api } from '../services/api'

export default function Rehber() {
  const [kisiler, setKisiler] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    ad_soyad: '', email: '', telefon: '', varsayilan: false
  })

  const loadKisiler = () => {
    setLoading(true)
    api.getRehber()
      .then(setKisiler)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadKisiler() }, [])

  const handleSubmit = (e) => {
    e.preventDefault()
    api.addRehber(form)
      .then(() => {
        setShowForm(false)
        setForm({ ad_soyad: '', email: '', telefon: '', varsayilan: false })
        loadKisiler()
      })
      .catch(console.error)
  }

  if (loading) return <div className="p-8 text-center text-gray-500">Yüklənir...</div>

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Rehber</h2>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> Yeni Əlaqə
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-gray-50 rounded-lg p-4 mb-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <input
                type="text" placeholder="Ad Soyad *" required
                value={form.ad_soyad} onChange={e => setForm({...form, ad_soyad: e.target.value})}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
              <input
                type="email" placeholder="Email"
                value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
              <input
                type="text" placeholder="Telefon (+994...)"
                value={form.telefon} onChange={e => setForm({...form, telefon: e.target.value})}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox" checked={form.varsayilan}
                  onChange={e => setForm({...form, varsayilan: e.target.checked})}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">Avtomatik göndər</span>
              </label>
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

      {kisiler.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Rehberdə heç kim yoxdur</p>
          <p className="text-sm text-gray-400 mt-1">Rapor göndərmək üçün əlaqə əlavə edin</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {kisiler.map((k) => (
            <div key={k.id} className="bg-white rounded-xl shadow-sm border p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                  <UserCircle className="w-6 h-6 text-purple-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{k.ad_soyad}</h3>
                    {k.varsayilan && (
                      <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                    )}
                  </div>
                  {k.pozisya && <p className="text-sm text-gray-500">{k.pozisya}</p>}
                  <div className="mt-2 space-y-1">
                    {k.email && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Mail className="w-4 h-4 text-gray-400" />
                        {k.email}
                      </div>
                    )}
                    {k.telefon && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone className="w-4 h-4 text-gray-400" />
                        {k.telefon}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
