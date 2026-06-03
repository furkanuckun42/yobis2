'use client'

import { useState } from 'react'
import { 
  LayoutDashboard, 
  Users, 
  Film, 
  Wallet, 
  RotateCcw, 
  Loader2, 
  Sparkles,
  ClipboardList,
  Shield,
  Building2,
  Clock,
  Briefcase,
  Activity,
  CreditCard,
  Calendar
} from 'lucide-react'

export default function Sidebar({ activeTab, setActiveTab, onUndoSuccess, currentUser, addToast }) {
  const [undoing, setUndoing] = useState(false)
  const [undoMessage, setUndoMessage] = useState('')

  const menuItems = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
    { id: 'customers', name: 'Müşteriler', icon: Users },
    { id: 'caris', name: 'Cari Yönetimi', icon: Building2 },
    { id: 'projects', name: 'Çalışmalar', icon: Film },
    { id: 'finance', name: 'Finans', icon: Wallet },
    { id: 'tasks', name: 'Görevler', icon: ClipboardList },
    { id: 'worklogs', name: 'İş Kayıt Defteri', icon: Clock },
    { id: 'calendar', name: 'Takvim', icon: Calendar },
  ]

  if (currentUser?.role === 'admin') {
    menuItems.push({ id: 'monthlyCustomers', name: 'Aylık Müşteriler', icon: CreditCard })
    menuItems.push({ id: 'employees', name: 'Çalışanlar', icon: Briefcase })
    menuItems.push({ id: 'users', name: 'Kullanıcılar', icon: Shield })
    menuItems.push({ id: 'systemLogs', name: 'Sistem Günlükleri', icon: Activity })
  }

  const handleUndo = async () => {
    setUndoing(true)
    setUndoMessage('')
    try {
      const res = await fetch('/api/undo', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        if (addToast) {
          addToast('Son yapılan işlem başarıyla geri alındı.', 'success')
        } else {
          setUndoMessage('İşlem geri alındı!')
          setTimeout(() => setUndoMessage(''), 3000)
        }
        if (onUndoSuccess) onUndoSuccess()
      } else {
        if (addToast) {
          addToast(data.error || 'Geri alınacak son işlem bulunamadı!', 'error')
        } else {
          alert(data.error || 'Geri alınacak son işlem bulunamadı!')
        }
      }
    } catch (err) {
      console.error(err)
      if (addToast) {
        addToast('Geri alma işlemi başarısız.', 'error')
      } else {
        alert('Geri alma işlemi başarısız.')
      }
    } finally {
      setUndoing(false)
    }
  }

  return (
    <aside className="w-64 border-r border-violet-500/10 glass flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="p-6 border-b border-violet-500/10 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-transparent flex items-center justify-center">
          <img src="/logo.png" alt="HD STUDIO Logo" className="w-8 h-8 object-contain filter drop-shadow-[0_0_8px_rgba(139,92,246,0.4)]" />
        </div>
        <div>
          <h1 className="font-bold text-lg tracking-wider bg-gradient-to-r from-white to-violet-400 bg-clip-text text-transparent glow-text">
            HD STUDIO
          </h1>
          <p className="text-[10px] text-violet-400 font-semibold tracking-widest uppercase">
            Local Management
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.id
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/20'
                  : 'text-gray-400 hover:text-violet-400 hover:bg-violet-950/20'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.name}</span>
            </button>
          )
        })}
      </nav>

      {/* Undo Button Section */}
      <div className="p-4 border-t border-violet-500/10 space-y-2">
        {undoMessage && (
          <div className="text-xs text-center py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg">
            {undoMessage}
          </div>
        )}
        <button
          onClick={handleUndo}
          disabled={undoing}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 border border-rose-500/20 hover:border-rose-500/40 bg-rose-950/10 hover:bg-rose-950/30 text-rose-400 hover:text-rose-300 text-xs font-semibold rounded-lg transition-all duration-200 cursor-pointer disabled:opacity-50"
        >
          {undoing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RotateCcw className="w-3.5 h-3.5" />
          )}
          <span>Geri Al</span>
        </button>
      </div>
    </aside>
  )
}
