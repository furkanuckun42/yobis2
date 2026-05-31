'use client'

import { useState, useEffect, useRef } from 'react'
import { 
  Film, 
  Plus, 
  Trash2, 
  Edit3, 
  Calendar, 
  DollarSign, 
  Briefcase, 
  User, 
  Save,
  ClipboardList,
  Loader2,
  Archive,
  MessageSquare,
  Paperclip,
  Upload,
  FileText,
  Trash
} from 'lucide-react'

export default function Projects({ onAction, currentUser, addToast, showConfirm }) {
  const [projects, setProjects] = useState([])
  const [customers, setCustomers] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedProject, setSelectedProject] = useState(null)
  
  // Right Panel Tabs & States
  const [rightTab, setRightTab] = useState('edit') // 'edit', 'assign', 'attachments', 'comments'
  const [assignUserId, setAssignUserId] = useState('')
  const [assigning, setAssigning] = useState(false)
  const isAdmin = currentUser?.role === 'admin'

  // Filter tab: Active vs Archived
  const [filterArchived, setFilterArchived] = useState(false)
  const [selectedCustomerFilter, setSelectedCustomerFilter] = useState('')

  // Attachments State
  const [attachments, setAttachments] = useState([])
  const [attachmentsLoading, setAttachmentsLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)

  // Comments State
  const [comments, setComments] = useState([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [commentText, setCommentText] = useState('')

  // Form State
  const [form, setForm] = useState({
    name: '',
    customerId: '',
    stage: 'Teklif Aşamasında',
    deliveryDate: ''
  })
  const [isEditing, setIsEditing] = useState(false)
  const [previewFile, setPreviewFile] = useState(null)

  const stages = [
    'Teklif Aşamasında',
    'Devam Ediyor',
    'Revize Bekliyor',
    'Teslime Hazır',
    'Teslim Edildi'
  ]

  const fetchProjectsAndCustomers = async () => {
    try {
      const [projRes, custRes] = await Promise.all([
        fetch('/api/projects'),
        fetch('/api/customers')
      ])
      
      if (projRes.ok && custRes.ok) {
        const projJson = await projRes.json()
        const custJson = await custRes.json()
        setProjects(projJson)
        setCustomers(custJson)
      }
    } catch (err) {
      console.error('Yükleme hatası:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/auth/users', {
        headers: {
          'x-requester-id': currentUser?.id || '',
          'x-requester-role': currentUser?.role || ''
        }
      })
      if (res.ok) {
        const json = await res.json()
        setUsers(json)
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Fetch attachments and comments on project selection
  const fetchAttachments = async (projId) => {
    setAttachmentsLoading(true)
    try {
      const res = await fetch(`/api/attachments?projectId=${projId}`)
      if (res.ok) {
        const json = await res.json()
        setAttachments(json)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setAttachmentsLoading(false)
    }
  }

  const fetchComments = async (projId) => {
    setCommentsLoading(true)
    try {
      const res = await fetch(`/api/projects/comments?projectId=${projId}`)
      if (res.ok) {
        const json = await res.json()
        setComments(json)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setCommentsLoading(false)
    }
  }

  useEffect(() => {
    fetchProjectsAndCustomers()
    if (currentUser) {
      fetchUsers()
    }
  }, [currentUser])

  useEffect(() => {
    if (selectedProject) {
      fetchAttachments(selectedProject.id)
      fetchComments(selectedProject.id)
    }
  }, [selectedProject])

  const resetForm = () => {
    setForm({
      name: '',
      customerId: '',
      stage: 'Teklif Aşamasında',
      deliveryDate: ''
    })
    setIsEditing(false)
    setSelectedProject(null)
    setAssignUserId('')
    setRightTab('edit')
    setAttachments([])
    setComments([])
  }

  const handleAssignProjectAsTask = async (e) => {
    e.preventDefault()
    if (!selectedProject || !assignUserId) return
    
    setAssigning(true)
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${selectedProject.name} Projesi`,
          description: `Müşteri: ${selectedProject.customer?.name || 'Belirtilmemiş'}. Bu proje size görev olarak atanmıştır. Lütfen gerekli hazırlıkları tamamlayın.`,
          assignedUserId: assignUserId,
          dueDate: selectedProject.deliveryDate,
          status: 'Bekliyor',
          projectId: selectedProject.id
        })
      })

      if (res.ok) {
        addToast('Proje başarıyla personele görev olarak atandı.', 'success')
        setAssignUserId('')
      } else {
        const err = await res.json()
        addToast(err.error || 'Görev atanamadı', 'error')
      }
    } catch (err) {
      console.error(err)
      addToast('Bağlantı hatası oluştu.', 'error')
    } finally {
      setAssigning(false)
    }
  }

  const handleSelectProject = (project) => {
    setSelectedProject(project)
    
    // Format date to YYYY-MM-DD
    const rawDate = new Date(project.deliveryDate)
    const formattedDate = rawDate.toISOString().split('T')[0]

    setForm({
      name: project.name,
      customerId: project.customerId,
      stage: project.stage,
      deliveryDate: formattedDate
    })
    setIsEditing(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.customerId || !form.deliveryDate) {
      addToast('Lütfen tüm zorunlu alanları doldurun!', 'warning')
      return
    }

    const method = isEditing ? 'PUT' : 'POST'
    const bodyData = isEditing 
      ? { id: selectedProject.id, ...form } 
      : form

    try {
      const res = await fetch('/api/projects', {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'x-requester-id': currentUser?.id || '',
          'x-requester-role': currentUser?.role || ''
        },
        body: JSON.stringify(bodyData)
      })

      if (res.ok) {
        fetchProjectsAndCustomers()
        resetForm()
        if (onAction) onAction()
      } else {
        const err = await res.json()
        addToast(err.error || 'İşlem başarısız', 'error')
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleDelete = async (id) => {
    showConfirm('Bu projeyi silmek istediğinizden emin misiniz?', async () => {
      try {
        const res = await fetch(`/api/projects?id=${id}`, { method: 'DELETE' })
        if (res.ok) {
          fetchProjectsAndCustomers()
          resetForm()
          if (onAction) onAction()
        } else {
          const err = await res.json()
          addToast(err.error || 'Silme başarısız', 'error')
        }
      } catch (err) {
        console.error(err)
      }
    })
  }

  const handleArchiveToggle = async (project, archiveState) => {
    try {
      const res = await fetch('/api/projects', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'x-requester-id': currentUser?.id || '',
          'x-requester-role': currentUser?.role || ''
        },
        body: JSON.stringify({ id: project.id, isArchived: archiveState })
      })

      if (res.ok) {
        fetchProjectsAndCustomers()
        resetForm()
        if (onAction) onAction()
      } else {
        const err = await res.json()
        addToast(err.error || 'Arşivleme başarısız', 'error')
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleFastStageChange = async (projectId, newStage) => {
    try {
      const res = await fetch('/api/projects', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-requester-id': currentUser?.id || '',
          'x-requester-role': currentUser?.role || ''
        },
        body: JSON.stringify({ id: projectId, stage: newStage })
      })
      if (res.ok) {
        fetchProjectsAndCustomers()
        if (onAction) onAction()
      } else {
        const err = await res.json()
        addToast(err.error || 'Aşama güncellenemedi', 'error')
      }
    } catch (err) {
      console.error(err)
    }
  }

  const getProgressPercentage = (stage) => {
    switch (stage) {
      case 'Teklif Aşamasında': return 15
      case 'Devam Ediyor': return 40
      case 'Revize Bekliyor': return 65
      case 'Teslime Hazır': return 85
      case 'Teslim Edildi': return 100
      default: return 0
    }
  }

  const getProgressColor = (stage) => {
    switch (stage) {
      case 'Teklif Aşamasında': return 'bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.3)]'
      case 'Devam Ediyor': return 'bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.3)]'
      case 'Revize Bekliyor': return 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.3)]'
      case 'Teslime Hazır': return 'bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.3)]'
      case 'Teslim Edildi': return 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
      default: return 'bg-gray-500'
    }
  }

  // Attachments Actions
  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file || !selectedProject) return

    if (file.size > 5 * 1024 * 1024) {
      addToast('Dosya boyutu 5MB sınırını aşamaz.', 'warning')
      return
    }

    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('projectId', selectedProject.id)

    try {
      const res = await fetch('/api/attachments', {
        method: 'POST',
        body: formData
      })
      if (res.ok) {
        fetchAttachments(selectedProject.id)
      } else {
        const err = await res.json()
        addToast(err.error || 'Dosya yüklenemedi.', 'error')
      }
    } catch (err) {
      console.error(err)
      addToast('Bağlantı hatası.', 'error')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDeleteAttachment = async (attId) => {
    showConfirm('Bu dosyayı silmek istediğinizden emin misiniz?', async () => {
      try {
        const res = await fetch(`/api/attachments?id=${attId}`, { method: 'DELETE' })
        if (res.ok) {
          fetchAttachments(selectedProject.id)
        } else {
          const err = await res.json()
          addToast(err.error || 'Dosya silinemedi.', 'error')
        }
      } catch (err) {
        console.error(err)
      }
    })
  }

  // Comments Actions
  const handleAddComment = async (e) => {
    e.preventDefault()
    if (!commentText.trim() || !selectedProject) return

    try {
      const res = await fetch('/api/projects/comments', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-requester-id': currentUser?.id || '',
          'x-requester-role': currentUser?.role || ''
        },
        body: JSON.stringify({
          projectId: selectedProject.id,
          text: commentText
        })
      })

      if (res.ok) {
        setCommentText('')
        fetchComments(selectedProject.id)
      } else {
        const err = await res.json()
        addToast(err.error || 'Yorum eklenemedi.', 'error')
      }
    } catch (err) {
      console.error(err)
    }
  }

  const getStageStyles = (stage) => {
    switch (stage) {
      case 'Teklif Aşamasında':
        return 'bg-sky-500/10 text-sky-400 border-sky-500/20'
      case 'Devam Ediyor':
        return 'bg-violet-500/10 text-violet-400 border-violet-500/20'
      case 'Revize Bekliyor':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
      case 'Teslime Hazır':
        return 'bg-pink-500/10 text-pink-400 border-pink-500/20'
      case 'Teslim Edildi':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
    }
  }

  const filteredProjects = projects.filter(p => {
    const matchesArchive = p.isArchived === filterArchived
    const matchesCustomer = selectedCustomerFilter ? p.customerId === selectedCustomerFilter : true
    return matchesArchive && matchesCustomer
  })

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Title & Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight glow-text text-white">Çalışmalar</h2>
          <p className="text-gray-400 mt-1">Prodüksiyon aşamalarını izleyin ve çalışmalarınızı düzenleyin.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Müşteri Filtresi */}
          <select
            value={selectedCustomerFilter}
            onChange={(e) => setSelectedCustomerFilter(e.target.value)}
            className="text-xs px-3.5 py-2 rounded-xl bg-violet-950/20 border border-violet-500/10 text-gray-300 focus:outline-none focus:border-violet-500 transition cursor-pointer min-h-[38px]"
          >
            <option value="" className="bg-[#05020c] text-white">Tüm Müşteriler</option>
            {customers.map(c => (
              <option key={c.id} value={c.id} className="bg-[#05020c] text-white">{c.name}</option>
            ))}
          </select>

          {/* Active / Archive Toggle */}
          <div className="flex gap-1.5 p-1 bg-violet-950/20 border border-violet-500/10 rounded-xl w-fit">
            <button
              onClick={() => {
                setFilterArchived(false)
                resetForm()
              }}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                !filterArchived 
                  ? 'bg-violet-600 text-white glow-purple shadow-md' 
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Aktif Çalışmalar
            </button>
            <button
              onClick={() => {
                setFilterArchived(true)
                resetForm()
              }}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                filterArchived 
                  ? 'bg-violet-600 text-white glow-purple shadow-md' 
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Arşivdekiler
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Projects list */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-lg text-white flex items-center gap-2">
              <Film className="w-5 h-5 text-violet-400" />
              <span>{filterArchived ? 'Arşivlenen Çalışmalar' : 'Aktif Çalışmalar'}</span>
            </h3>
            {isEditing && (
              <button 
                onClick={resetForm}
                className="text-xs px-3 py-1.5 bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 border border-violet-500/20 rounded-lg font-semibold transition cursor-pointer"
              >
                Yeni Çalışma
              </button>
            )}
          </div>

          {loading ? (
            <div className="py-24 flex justify-center items-center rounded-2xl glass">
              <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="text-center py-24 text-gray-500 text-sm rounded-2xl glass border border-violet-500/5">
              {filterArchived 
                ? 'Arşivlenmiş çalışma bulunamadı.' 
                : 'Kayıtlı aktif çalışma bulunamadı. Sağdaki formu kullanarak yeni çalışma ekleyin.'}
            </div>
          ) : (
            <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-2">
              {filteredProjects.map((p) => {
                const isSelected = selectedProject?.id === p.id
                return (
                  <div
                    key={p.id}
                    onClick={() => handleSelectProject(p)}
                    className={`p-5 rounded-2xl cursor-pointer text-left transition-all border flex flex-col md:flex-row justify-between md:items-center gap-4 ${
                      isSelected
                        ? 'bg-violet-950/40 border-violet-500 glow-purple shadow-lg'
                        : 'glass-card border-violet-500/10'
                    }`}
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <h4 className="font-bold text-base text-white">{p.name}</h4>
                        <select
                          value={p.stage}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => handleFastStageChange(p.id, e.target.value)}
                          className={`px-2.5 py-0.5 text-xs rounded-full border cursor-pointer focus:outline-none bg-[#0a0516] font-semibold transition ${getStageStyles(p.stage)}`}
                        >
                          {stages.map(st => (
                            <option key={st} value={st} className="bg-[#05020c] text-white">
                              {st}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-gray-400">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-violet-400" />
                          <span>Müşteri: {p.customer?.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-violet-400" />
                          <span>Teslim: {new Date(p.deliveryDate).toLocaleDateString('tr-TR')}</span>
                        </div>
                      </div>

                      {/* İlerleme Barı */}
                      <div className="w-full mt-2.5 bg-violet-950/40 rounded-full h-1 overflow-hidden border border-violet-500/5">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${getProgressColor(p.stage)}`} 
                          style={{ width: `${getProgressPercentage(p.stage)}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-4 border-t md:border-t-0 pt-3 md:pt-0 border-violet-500/5">
                      <div className="text-left md:text-right mr-2 text-[10px] text-gray-500 space-y-0.5">
                        {p.lastUpdatedBy && (
                          <div className="block">
                            <span className="font-bold text-gray-400">Düzenleyen:</span> {p.lastUpdatedBy}
                          </div>
                        )}
                        <div className="block">
                          <span className="font-bold text-gray-400">Son Güncelleme:</span> {new Date(p.updatedAt).toLocaleString('tr-TR', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {/* Arşiv Butonu (Sadece Admin için görünür ve tıklanabilir) */}
                        {isAdmin && (
                          <button
                            disabled={!p.isArchived && p.stage !== 'Teslim Edildi'}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleArchiveToggle(p, !p.isArchived)
                            }}
                            className={`p-2 rounded-xl transition border ${
                              (!p.isArchived && p.stage !== 'Teslim Edildi')
                                ? 'opacity-40 cursor-not-allowed border-violet-500/10 text-gray-500 bg-transparent'
                                : p.isArchived 
                                  ? 'bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 border-violet-500/20' 
                                  : 'bg-violet-950/30 text-violet-400 hover:bg-violet-950/50 border-violet-500/20'
                            }`}
                            title={
                              p.isArchived 
                                ? "Arşivden Çıkar" 
                                : p.stage !== 'Teslim Edildi'
                                  ? "Arşivlemek için projenin teslim edilmiş (Teslim Edildi) olması gerekir"
                                  : "Arşive Kaldır"
                            }
                          >
                            <Archive className="w-4.5 h-4.5" />
                          </button>
                        )}

                        {/* Sil Butonu */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(p.id)
                          }}
                          className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl transition"
                          title="Projeyi Sil"
                        >
                          <Trash2 className="w-4.5 h-4.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right Column: Tabbed Panel */}
        <div className="space-y-6">
          {/* Tab Navigation if selectedProject */}
          {selectedProject && (
            <div className="flex p-1 bg-violet-950/20 border border-violet-500/10 rounded-xl w-full">
              <button
                onClick={() => setRightTab('edit')}
                className={`flex-1 py-2 text-center rounded-lg text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  rightTab === 'edit' ? 'bg-violet-600 text-white shadow-md' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Düzenle</span>
              </button>
              <button
                onClick={() => setRightTab('attachments')}
                className={`flex-1 py-2 text-center rounded-lg text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  rightTab === 'attachments' ? 'bg-violet-600 text-white shadow-md' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Paperclip className="w-3.5 h-3.5" />
                <span>Dosyalar ({attachments.length})</span>
              </button>
              <button
                onClick={() => setRightTab('comments')}
                className={`flex-1 py-2 text-center rounded-lg text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  rightTab === 'comments' ? 'bg-violet-600 text-white shadow-md' : 'text-gray-400 hover:text-white'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Yorumlar ({comments.length})</span>
              </button>
              {isAdmin && (
                <button
                  onClick={() => setRightTab('assign')}
                  className={`flex-1 py-2 text-center rounded-lg text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    rightTab === 'assign' ? 'bg-violet-600 text-white shadow-md' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <ClipboardList className="w-3.5 h-3.5" />
                  <span>Ata</span>
                </button>
              )}
            </div>
          )}

          {/* Tab 1: Edit/Add Project */}
          {(!selectedProject || rightTab === 'edit') && (
            <div className="p-6 rounded-2xl glass-card space-y-4 text-left">
              <h3 className="font-bold text-lg text-white flex items-center gap-2 pb-2 border-b border-violet-500/10">
                <Briefcase className="w-5 h-5 text-violet-400" />
                <span>{isEditing ? 'Çalışma Düzenle' : 'Yeni Çalışma Ekle'}</span>
              </h3>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Çalışma Adı</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Örn: Tanıtım Filmi Prodüksiyonu"
                    className="w-full text-sm px-4 py-2.5 rounded-xl bg-violet-950/20 border border-violet-500/10 text-white focus:outline-none focus:border-violet-500/40 focus:bg-violet-950/30 transition"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-1">Müşteri Seçin</label>
                  <select
                    required
                    value={form.customerId}
                    onChange={(e) => setForm({ ...form, customerId: e.target.value })}
                    className="w-full text-sm px-4 py-2.5 rounded-xl bg-violet-950/20 border border-violet-500/10 text-white focus:outline-none focus:border-violet-500/40 focus:bg-violet-950/30 transition cursor-pointer"
                  >
                    <option value="" disabled className="bg-slate-900 text-gray-400">Müşteri seçin...</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-1">Çalışma Aşaması</label>
                  <select
                    value={form.stage}
                    onChange={(e) => setForm({ ...form, stage: e.target.value })}
                    className="w-full text-sm px-4 py-2.5 rounded-xl bg-violet-950/20 border border-violet-500/10 text-white focus:outline-none focus:border-violet-500/40 focus:bg-violet-950/30 transition cursor-pointer"
                  >
                    {stages.map((stage) => (
                      <option key={stage} value={stage} className="bg-slate-900 text-white">
                        {stage}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-1">Teslim Tarihi</label>
                  <input
                    type="date"
                    required
                    value={form.deliveryDate}
                    onChange={(e) => setForm({ ...form, deliveryDate: e.target.value })}
                    className="w-full text-sm px-4 py-2.5 rounded-xl bg-violet-950/20 border border-violet-500/10 text-white focus:outline-none focus:border-violet-500/40 focus:bg-violet-950/30 transition"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  {isEditing && (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="flex-1 py-2.5 border border-violet-500/20 hover:bg-violet-950/20 text-gray-300 text-sm font-semibold rounded-xl transition cursor-pointer"
                    >
                      Vazgeç
                    </button>
                  )}
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isEditing ? 'Güncelle' : 'Kaydet'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Tab 2: Project Attachments */}
          {selectedProject && rightTab === 'attachments' && (
            <div className="p-6 rounded-2xl glass-card space-y-4 text-left">
              <div className="flex justify-between items-center pb-2 border-b border-violet-500/10">
                <h3 className="font-bold text-lg text-white flex items-center gap-2">
                  <Paperclip className="w-5 h-5 text-violet-400" />
                  <span>Proje Dosyaları</span>
                </h3>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="p-2 bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 rounded-xl transition border border-violet-500/20 cursor-pointer disabled:opacity-50"
                  title="Dosya Yükle"
                >
                  {uploading ? (
                    <Loader2 className="w-4.5 h-4.5 animate-spin" />
                  ) : (
                    <Upload className="w-4.5 h-4.5" />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>

              {/* Attachments List */}
              {attachmentsLoading ? (
                <div className="py-8 flex justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
                </div>
              ) : attachments.length === 0 ? (
                <div className="text-center py-10 text-xs text-gray-500 italic">
                  Henüz dosya eklenmemiş. PDF, Görsel veya Belge yükleyebilirsiniz.
                </div>
              ) : (
                <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                  {attachments.map((att) => (
                    <div 
                      key={att.id}
                      className="p-3 bg-violet-950/10 border border-violet-500/5 rounded-xl flex items-center justify-between text-xs hover:border-violet-500/15 transition-all"
                    >
                      <button
                        type="button"
                        onClick={() => setPreviewFile(att)}
                        className="flex items-center gap-2 hover:text-violet-400 text-gray-300 font-semibold truncate flex-1 mr-2 text-left"
                        title={`${att.name} - Önizlemek için tıklayın`}
                      >
                        <FileText className="w-4 h-4 text-violet-400 shrink-0" />
                        <span className="truncate">{att.name}</span>
                      </button>
                      
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[10px] text-gray-500 font-mono">
                          {(att.size / 1024 / 1024).toFixed(2)} MB
                        </span>
                        
                        <button
                          onClick={() => handleDeleteAttachment(att.id)}
                          className="p-1 hover:bg-rose-500/20 text-rose-400 rounded transition cursor-pointer"
                          title="Dosyayı Sil"
                        >
                          <Trash className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Comments */}
          {selectedProject && rightTab === 'comments' && (
            <div className="p-6 rounded-2xl glass-card space-y-4 text-left">
              <h3 className="font-bold text-lg text-white flex items-center gap-2 pb-2 border-b border-violet-500/10">
                <MessageSquare className="w-5 h-5 text-violet-400" />
                <span>Yorumlar & Günlük Notlar</span>
              </h3>

              {/* Comments stream */}
              {commentsLoading ? (
                <div className="py-8 flex justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
                </div>
              ) : comments.length === 0 ? (
                <div className="text-center py-10 text-xs text-gray-500 italic">
                  Yazılmış yorum bulunmuyor. Ekip için ilk notu siz bırakın!
                </div>
              ) : (
                <div className="space-y-3 max-h-[35vh] overflow-y-auto pr-1">
                  {comments.map((comm) => (
                    <div 
                      key={comm.id}
                      className="p-3 bg-violet-950/15 border border-violet-500/5 rounded-xl space-y-1"
                    >
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="font-bold text-violet-400">
                          {comm.user?.displayName || comm.user?.username} 
                          <span className="text-gray-500 font-normal"> (@{comm.user?.username})</span>
                        </span>
                        <span className="text-gray-500">
                          {new Date(comm.createdAt).toLocaleString('tr-TR', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">{comm.text}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Comment Input */}
              <form onSubmit={handleAddComment} className="pt-2 border-t border-violet-500/5 space-y-2">
                <textarea
                  placeholder="Yorumunuzu veya notunuzu buraya yazın..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  rows="2"
                  className="w-full text-xs p-3 rounded-xl bg-violet-950/20 border border-violet-500/10 text-white focus:outline-none focus:border-violet-500/40 placeholder:text-gray-600 resize-none"
                  required
                />
                <button
                  type="submit"
                  className="w-full py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
                >
                  Yorum Gönder
                </button>
              </form>
            </div>
          )}

          {/* Tab 4: Personele Görev Olarak Ata */}
          {selectedProject && rightTab === 'assign' && isAdmin && (
            <div className="p-6 rounded-2xl glass-card space-y-4 border border-violet-500/20 text-left">
              <h3 className="font-bold text-lg text-white flex items-center gap-2 pb-2 border-b border-violet-500/10">
                <ClipboardList className="w-5 h-5 text-violet-400" />
                <span>Görev Olarak Ata</span>
              </h3>
              <form onSubmit={handleAssignProjectAsTask} className="space-y-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Görevlendirilecek Personel</label>
                  <select
                    required
                    value={assignUserId}
                    onChange={(e) => setAssignUserId(e.target.value)}
                    className="w-full text-sm px-4 py-2.5 rounded-xl bg-violet-950/20 border border-violet-500/10 text-white focus:outline-none focus:border-violet-500/40 focus:bg-violet-950/30 transition cursor-pointer"
                  >
                    <option value="" className="bg-[#05020c] text-gray-400">Personel seçin...</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id} className="bg-[#05020c] text-white">
                        {u.displayName || u.username} (@{u.username})
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={assigning}
                  className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
                >
                  {assigning ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardList className="w-4 h-4" />}
                  <span>Görevlendir</span>
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* File Previewer Lightbox Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="w-full max-w-4xl p-5 rounded-2xl glass-card border border-violet-500/15 text-left space-y-4 animate-scale-in max-h-[90vh] flex flex-col justify-between">
            <div className="flex justify-between items-center pb-2 border-b border-violet-500/10">
              <h3 className="font-bold text-sm text-white truncate max-w-[80%]">
                📁 Dosya Önizleme: {previewFile.name}
              </h3>
              <div className="flex items-center gap-2">
                <a
                  href={previewFile.path}
                  download={previewFile.name}
                  className="px-3 py-1 bg-violet-600 hover:bg-violet-500 text-xs font-bold text-white rounded-lg transition"
                >
                  İndir
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewFile(null)}
                  className="p-1 rounded-lg bg-violet-950/40 border border-violet-500/10 text-gray-400 hover:text-white transition cursor-pointer"
                >
                  Kapat
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto flex items-center justify-center min-h-[300px] bg-black/45 rounded-xl border border-violet-500/5 p-4">
              {(() => {
                const ext = previewFile.path.split('.').pop().toLowerCase()
                const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)
                const isPdf = ext === 'pdf'

                if (isImage) {
                  return (
                    <img
                      src={previewFile.path}
                      alt={previewFile.name}
                      className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-lg"
                    />
                  )
                }

                if (isPdf) {
                  return (
                    <iframe
                      src={previewFile.path}
                      title={previewFile.name}
                      className="w-full h-[60vh] rounded-lg border-0"
                    />
                  )
                }

                return (
                  <div className="text-center space-y-3">
                    <FileText className="w-16 h-16 text-violet-400 mx-auto" />
                    <p className="text-sm text-gray-400">
                      Bu dosya tipi doğrudan önizlenemiyor.
                    </p>
                    <a
                      href={previewFile.path}
                      download={previewFile.name}
                      className="inline-block px-4 py-2 bg-amber-600 hover:bg-amber-500 text-xs font-bold text-white rounded-xl transition"
                    >
                      Dosyayı İndir ve Görüntüle
                    </a>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
