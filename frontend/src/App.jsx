import { useState } from 'react'
import { BarChart3, Wallet, History, FileText, Users, LayoutDashboard } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import Hesaplar from './pages/Hesaplar'
import Hareketler from './pages/Hareketler'
import Raporlar from './pages/Raporlar'
import Rehber from './pages/Rehber'

function App() {
  const [activeTab, setActiveTab] = useState('dashboard')

  const tabs = [
    { id: 'dashboard', label: 'Ana Səhifə', icon: LayoutDashboard },
    { id: 'hesaplar', label: 'Hesablar', icon: Wallet },
    { id: 'hareketler', label: 'Əməliyyatlar', icon: History },
    { id: 'raporlar', label: 'Raporlar', icon: BarChart3 },
    { id: 'rehber', label: 'Rehber', icon: Users },
  ]

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />
      case 'hesaplar': return <Hesaplar />
      case 'hareketler': return <Hareketler />
      case 'raporlar': return <Raporlar />
      case 'rehber': return <Rehber />
      default: return <Dashboard />
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <Wallet className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Bank Kontrol</h1>
              <p className="text-sm text-gray-500">Banka əməliyyatları idarəetməsi</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 flex gap-6">
        {/* Sidebar */}
        <nav className="w-64 shrink-0">
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{tab.label}</span>
                </button>
              )
            })}
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1">
          {renderContent()}
        </main>
      </div>
    </div>
  )
}

export default App
