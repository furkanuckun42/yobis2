'use client'

import { useState, useEffect } from 'react'
import { Calendar, CheckCircle2, Circle, Clock, ClipboardList, Plus, Trash2, User, Loader2, FolderKanban } from 'lucide-react'

export default function Tasks({ currentUser, addToast, showConfirm }) {
  const [tasks, setTasks] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Tab/Filtreleme
  const [activeFilter, setActiveFilter] = useState('all') // 'all', 'my', veya 'project'

  // Ekleme formu state'leri
  const [showAddForm, setShowAddForm] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assignedUserId, setAssignedUserId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchTasksAndUsers = async () => {
    try {
      const [tasksRes, usersRes] = await Promise.all([
        fetch('/api/tasks'),
        fetch('/api/auth/users', {
          headers: {
            'x-requester-id': currentUser?.id || ''
          }
        })
      ])

      if (tasksRes.ok) {
        const tasksData = await tasksRes.json()
        setTasks(tasksData)
      }
      if (usersRes.ok) {
        const usersData = await usersRes.json()
        setUsers(usersData)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTasksAndUsers()
  }, [])

  const handleCreateTask = async (e) => {
    e.preventDefault()
    if (!title.trim()) {
      addToast('Lütfen görev başlığı girin!', 'warning')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-requester-id': currentUser?.id || '',
          'x-requester-role': currentUser?.role || ''
        },
        body: JSON.stringify({
          title,
          description,
          assignedUserId: assignedUserId || null,
          dueDate: dueDate || null
        })
      })

      const data = await res.json()
      if (res.ok) {
        addToast('Görev başarıyla oluşturuldu!', 'success')
        setTitle('')
        setDescription('')
        setAssignedUserId('')
        setDueDate('')
        setShowAddForm(false)
        fetchTasksAndUsers()
      } else {
        addToast(data.error || 'Görev oluşturulamadı.', 'error')
      }
    } catch (err) {
      console.error(err)
      addToast('Bağlantı hatası oluştu.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateStatus = async (taskId, newStatus) => {
    try {
      const res = await fetch('/api/tasks', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'x-requester-id': currentUser?.id || '',
          'x-requester-role': currentUser?.role || ''
        },
        body: JSON.stringify({
          id: taskId,
          status: newStatus
        })
      })

      if (res.ok) {
        fetchTasksAndUsers()
      } else {
        const data = await res.json()
        addToast(data.error || 'Durum güncellenemedi.', 'error')
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeleteTask = (taskId) => {
    showConfirm('Bu görevi silmek istediğinize emin misiniz?', async () => {
      try {
        const res = await fetch(`/api/tasks?id=${taskId}`, {
          method: 'DELETE',
          headers: {
            'x-requester-id': currentUser?.id || '',
            'x-requester-role': currentUser?.role || ''
          }
        })

        if (res.ok) {
          addToast('Görev başarıyla silindi!', 'success')
          fetchTasksAndUsers()
        } else {
          const data = await res.json()
          addToast(data.error || 'Görev silinemedi.', 'error')
        }
      } catch (err) {
        console.error(err)
      }
    })
  }

  // Görevleri filtrele
  const filteredTasks = tasks.filter(task => {
    if (activeFilter === 'my') {
      return task.assignedUserId === currentUser?.id
    }
    if (activeFilter === 'project') {
      return task.projectId != null
    }
    return true
  })

  const getStatusStyle = (status) => {
    switch (status) {
      case 'Tamamlandı':
        return 'border-emerald-500/20 text-emerald-400 bg-emerald-950/10'
      case 'Devam Ediyor':
        return 'border-violet-500/20 text-violet-400 bg-violet-950/10'
      default:
        return 'border-amber-500/20 text-amber-400 bg-amber-950/10'
    }
  }

  return (
    <div className="space-y-8 animate-fade-in text-left">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight glow-text text-white">Görevler</h2>
          <p className="text-gray-400 mt-1">Ekibe atanan işleri takip edin ve süreçleri yönetin.</p>
        </div>

        {currentUser?.role === 'admin' && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition cursor-pointer shadow-lg shadow-violet-600/20"
          >
            <Plus className="w-4.5 h-4.5" />
            <span>Yeni Görev Ekle</span>
          </button>
        )}
      </div>

      {/* Görev Ekleme Formu */}
      {showAddForm && currentUser?.role === 'admin' && (
        <form onSubmit={handleCreateTask} className="p-6 rounded-2xl glass-card space-y-4 animate-slide-in-top">
          <h4 className="font-bold text-lg text-white flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-violet-400" />
            <span>Yeni Görev Detayları</span>
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-xs text-gray-400 block mb-1.5 font-medium">Görev Başlığı</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Örn: Drone çekim dosyalarını teslim et..."
                className="w-full text-sm px-3.5 py-2.5 rounded-xl bg-violet-950/20 border border-violet-500/10 text-white focus:outline-none focus:border-violet-500 transition"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1.5 font-medium">Görevli Kişi</label>
              <select
                value={assignedUserId}
                onChange={(e) => setAssignedUserId(e.target.value)}
                className="w-full text-sm px-3.5 py-2.5 rounded-xl bg-violet-950/20 border border-violet-500/10 text-white focus:outline-none focus:border-violet-500 transition cursor-pointer"
              >
                <option value="" className="bg-[#05020c] text-white">Seçilmedi (Boşta)</option>
                {users.map(u => (
                  <option key={u.id} value={u.id} className="bg-[#05020c] text-white">
                    {u.username} ({u.role === 'admin' ? 'Yönetici' : 'Personel'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1.5 font-medium">Son Teslim Tarihi</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full text-sm px-3.5 py-2.5 rounded-xl bg-violet-950/20 border border-violet-500/10 text-white focus:outline-none focus:border-violet-500 transition"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-xs text-gray-400 block mb-1.5 font-medium">Açıklama (Opsiyonel)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Görevin detaylarını yazın..."
                rows={3}
                className="w-full text-sm px-3.5 py-2.5 rounded-xl bg-violet-950/20 border border-violet-500/10 text-white focus:outline-none focus:border-violet-500 transition resize-none"
              />
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 border border-violet-500/20 hover:border-violet-500/40 text-gray-400 hover:text-white text-sm font-semibold rounded-xl transition cursor-pointer"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition cursor-pointer disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              <span>Görev Ekle</span>
            </button>
          </div>
        </form>
      )}

      {/* Filtre Sekmeleri */}
      <div className="flex bg-violet-950/30 p-1 rounded-xl border border-violet-500/10 self-start w-fit">
        <button
          onClick={() => setActiveFilter('all')}
          className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
            activeFilter === 'all'
              ? 'bg-violet-600 text-white glow-purple'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Tüm Görevler
        </button>
        <button
          onClick={() => setActiveFilter('my')}
          className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
            activeFilter === 'my'
              ? 'bg-violet-600 text-white glow-purple'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Bana Atananlar
        </button>
        <button
          onClick={() => setActiveFilter('project')}
          className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
            activeFilter === 'project'
              ? 'bg-violet-600 text-white glow-purple'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Çalışma Görevleri
        </button>
      </div>

      {/* Görevler Tablosu / Listesi */}
      <div className="p-6 rounded-2xl glass-card space-y-4">
        {loading ? (
          <div className="py-12 flex justify-center items-center">
            <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="text-center py-12 text-gray-500 text-sm">
            Bu kategoride planlanmış görev bulunamadı.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTasks.map((task) => {
              const isAssignedToCurrentUser = task.assignedUserId === currentUser?.id
              const canEditStatus = currentUser?.role === 'admin' || isAssignedToCurrentUser

              return (
                <div
                  key={task.id}
                  className="p-5 rounded-2xl border border-violet-500/10 bg-violet-950/10 flex flex-col justify-between space-y-4 group hover:border-violet-500/20 transition-all duration-200"
                >
                  <div className="space-y-2">
                    {task.projectId && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
                        Çalışma{task.project?.name ? `: ${task.project.name}` : ''}
                      </span>
                    )}
                    <div className="flex items-start justify-between">
                      <h4 className="font-bold text-white text-base leading-snug">{task.title}</h4>
                      {currentUser?.role === 'admin' && (
                        <button
                          onClick={() => handleDeleteTask(task.id)}
                          className="p-1.5 rounded-lg border border-rose-500/10 hover:border-rose-500/30 bg-rose-950/5 hover:bg-rose-950/20 text-rose-400 transition opacity-60 group-hover:opacity-100 cursor-pointer"
                          title="Görevi Sil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    {task.description && (
                      <p className="text-xs text-gray-400 line-clamp-3 leading-relaxed">{task.description}</p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-violet-500/5 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {/* Atanan Kişi */}
                      <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-violet-950/20 px-2.5 py-1.5 rounded-lg border border-violet-500/5">
                        <User className="w-3.5 h-3.5 text-violet-400" />
                        <span className="font-semibold text-white">
                          {task.assignedUser?.username || 'Atanmadı'}
                        </span>
                      </div>

                      {/* Teslim Tarihi */}
                      {task.dueDate && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-violet-950/20 px-2.5 py-1.5 rounded-lg border border-violet-500/5">
                          <Calendar className="w-3.5 h-3.5 text-violet-400" />
                          <span className="font-medium text-white">
                            {new Date(task.dueDate).toLocaleDateString('tr-TR')}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Durum / Durum Değiştirme */}
                    {canEditStatus ? (
                      <select
                        value={task.status}
                        onChange={(e) => handleUpdateStatus(task.id, e.target.value)}
                        className={`text-xs px-2.5 py-1.5 rounded border font-semibold cursor-pointer focus:outline-none ${getStatusStyle(
                          task.status
                        )}`}
                      >
                        <option value="Bekliyor" className="bg-[#05020c] text-white">Bekliyor</option>
                        <option value="Devam Ediyor" className="bg-[#05020c] text-white">Devam Ediyor</option>
                        <option value="Tamamlandı" className="bg-[#05020c] text-white">Tamamlandı</option>
                      </select>
                    ) : (
                      <span className={`px-2.5 py-1 text-xs rounded border font-semibold ${getStatusStyle(
                        task.status
                      )}`}>
                        {task.status}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
