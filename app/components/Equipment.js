'use client'

import { useState, useEffect } from 'react'
import { 
  Camera, 
  Plus, 
  Trash2, 
  Settings, 
  Monitor, 
  RotateCcw,
  Check,
  Wrench,
  Truck,
  Save
} from 'lucide-react'

export default function Equipment({ onAction, addToast, showConfirm }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Form State
  const [name, setName] = useState('')
  const [status, setStatus] = useState('OFIS')

  const fetchEquipment = async () => {
    try {
      const res = await fetch('/api/equipment')
      if (res.ok) {
        const json = await res.json()
        setItems(json)
      }
    } catch (err) {
      console.error('Ekipman yüklenemedi:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEquipment()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return

    try {
      const res = await fetch('/api/equipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, status })
      })

      if (res.ok) {
        fetchEquipment()
        setName('')
        setStatus('OFIS')
        if (onAction) onAction()
      } else {
        const err = await res.json()
        if (addToast) {
          addToast(err.error || 'Ekipman eklenemedi', 'error')
        } else {
          alert(err.error || 'Ekipman eklenemedi')
        }
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleUpdateStatus = async (id, newStatus) => {
    try {
      const res = await fetch('/api/equipment', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus })
      })

      if (res.ok) {
        fetchEquipment()
        if (onAction) onAction()
      } else {
        const err = await res.json()
        if (addToast) {
          addToast(err.error || 'Durum güncellenemedi', 'error')
        } else {
          alert(err.error || 'Durum güncellenemedi')
        }
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleDelete = (id) => {
    showConfirm('Bu ekipmanı envanterden silmek istediğinizden emin misiniz?', async () => {
      try {
        const res = await fetch(`/api/equipment?id=${id}`, { method: 'DELETE' })
        if (res.ok) {
          fetchEquipment()
          if (onAction) onAction()
        } else {
          const err = await res.json()
          if (addToast) {
            addToast(err.error || 'Silme başarısız', 'error')
          } else {
            alert(err.error || 'Silme başarısız')
          }
        }
      } catch (err) {
        console.error(err)
      }
    })
  }

  const getStatusBadge = (s) => {
    switch (s) {
      case 'OFIS':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
      case 'SET':
        return 'bg-violet-500/10 text-violet-400 border-violet-500/20'
      case 'BAKIM':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
    }
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Title */}
      <div>
        <h2 className="text-3xl font-extrabold tracking-tight glow-text text-white">Ekipman & Envanter Takibi</h2>
        <p className="text-gray-400 mt-1">Stüdyo ekipmanlarının konumlarını ve bakım durumlarını anlık yönetin.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Add Gear Form (1/3 width) */}
        <div className="p-6 rounded-2xl glass-card h-fit space-y-4">
          <h3 className="font-bold text-lg text-white flex items-center gap-2 pb-2 border-b border-violet-500/10">
            <Camera className="w-5 h-5 text-violet-400" />
            <span>Envantere Cihaz Ekle</span>
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Ekipman Adı / Modeli</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Örn: Sony A7 IV Gövde, 24-70mm GM II..."
                className="w-full text-sm px-4 py-2.5 rounded-xl bg-violet-950/20 border border-violet-500/10 text-white focus:outline-none focus:border-violet-500/40 focus:bg-violet-950/30 transition"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Başlangıç Durumu</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full text-sm px-4 py-2.5 rounded-xl bg-violet-950/20 border border-violet-500/10 text-white focus:outline-none focus:border-violet-500/40 focus:bg-violet-950/30 transition"
              >
                <option value="OFIS" className="bg-slate-900 text-white">Ofiste</option>
                <option value="SET" className="bg-slate-900 text-white">Sette</option>
                <option value="BAKIM" className="bg-slate-900 text-white">Bakımda / Arızalı</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition pt-2"
            >
              <Plus className="w-4.5 h-4.5" />
              <span>Envantere Ekle</span>
            </button>
          </form>
        </div>

        {/* Right Column: Gear List & Status Controls (2/3 width) */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="font-bold text-lg text-white flex items-center gap-2">
            <span>Envanter Listesi</span>
          </h3>

          {loading ? (
            <div className="py-24 flex justify-center items-center rounded-2xl glass">
              <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-24 text-gray-500 text-sm rounded-2xl glass">
              Envanterde henüz kayıtlı ekipman yok. Soldaki formu kullanarak ekleyin.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto pr-2">
              {items.map((item) => (
                <div key={item.id} className="p-5 rounded-2xl border border-violet-500/10 glass-card text-left space-y-4 flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <h4 className="font-bold text-white text-base">{item.name}</h4>
                      <span className={`px-2.5 py-0.5 text-xs rounded-full border inline-block ${getStatusBadge(item.status)}`}>
                        {item.status === 'OFIS' ? 'Ofiste' : item.status === 'SET' ? 'Sette' : 'Bakımda'}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg transition"
                      title="Envanterden Sil"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="border-t border-violet-500/5 pt-3 space-y-2">
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Hızlı Durum Değiştir</span>
                    <div className="grid grid-cols-3 gap-1">
                      <button
                        onClick={() => handleUpdateStatus(item.id, 'OFIS')}
                        className={`py-1.5 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1 transition ${
                          item.status === 'OFIS'
                            ? 'bg-emerald-600 border-emerald-500 text-white shadow-sm'
                            : 'bg-violet-950/10 border-violet-500/5 text-gray-400 hover:text-white'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Ofis</span>
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(item.id, 'SET')}
                        className={`py-1.5 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1 transition ${
                          item.status === 'SET'
                            ? 'bg-violet-600 border-violet-500 text-white shadow-sm'
                            : 'bg-violet-950/10 border-violet-500/5 text-gray-400 hover:text-white'
                        }`}
                      >
                        <Truck className="w-3.5 h-3.5" />
                        <span>Set</span>
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(item.id, 'BAKIM')}
                        className={`py-1.5 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1 transition ${
                          item.status === 'BAKIM'
                            ? 'bg-amber-600 border-amber-500 text-white shadow-sm'
                            : 'bg-violet-950/10 border-violet-500/5 text-gray-400 hover:text-white'
                        }`}
                      >
                        <Wrench className="w-3.5 h-3.5" />
                        <span>Bakım</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
