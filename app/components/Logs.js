'use client'

import { useState, useEffect } from 'react'
import { ClipboardList, Search, RefreshCw, Eye, Calendar, User, Info, Activity, Trash2, Loader2, Database, Upload, Download, Clock, Bell } from 'lucide-react'

// Yerel saat dilimine göre YYYY-MM-DD formatında tarih üretir (timezone-safe)
const getLocalDateString = (date = new Date()) => {
  const offset = date.getTimezoneOffset()
  const localDate = new Date(date.getTime() - (offset * 60 * 1000))
  return localDate.toISOString().split('T')[0]
}

export default function Logs({ currentUser, addToast, showConfirm }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterModel, setFilterModel] = useState('ALL')
  const [filterAction, setFilterAction] = useState('ALL')

  // Selection and Deletion States
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedLogIds, setSelectedLogIds] = useState([])
  const [deleting, setDeleting] = useState(false)

  // Backup & Restore states
  const [backingUp, setBackingUp] = useState(false)
  const [restoring, setRestoring] = useState(false)

  // Daily Kasa Notification Settings
  const [kasaTime, setKasaTime] = useState('19:30')
  const [savingTime, setSavingTime] = useState(false)
  const [testingKasa, setTestingKasa] = useState(false)

  const fetchKasaTime = async () => {
    try {
      const res = await fetch('/api/admin/settings', {
        headers: { 'x-requester-role': currentUser?.role || '' }
      })
      if (res.ok) {
        const data = await res.json()
        setKasaTime(data.kasaNotificationTime)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleSaveKasaTime = async (e) => {
    e.preventDefault()
    setSavingTime(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-requester-role': currentUser?.role || ''
        },
        body: JSON.stringify({ kasaNotificationTime: kasaTime })
      })
      const data = await res.json()
      if (res.ok) {
        addToast('Kasa bildirim saati başarıyla kaydedildi.', 'success')
      } else {
        addToast(data.error || 'Ayarlar kaydedilemedi.', 'error')
      }
    } catch (err) {
      console.error(err)
      addToast('Bağlantı hatası.', 'error')
    } finally {
      setSavingTime(false)
    }
  }

  const handleTestKasaNotification = async () => {
    setTestingKasa(true)
    try {
      const res = await fetch('/api/admin/settings/kasa-test', {
        method: 'POST',
        headers: {
          'x-requester-role': currentUser?.role || ''
        }
      })
      const data = await res.json()
      if (res.ok) {
        addToast(`Kasa bildirimi test mesajı gönderildi! (Kasa: ${data.balance})`, 'success')
      } else {
        addToast(data.error || 'Test bildirimi gönderilemedi.', 'error')
      }
    } catch (err) {
      console.error(err)
      addToast('Bağlantı hatası.', 'error')
    } finally {
      setTestingKasa(false)
    }
  }

  const handleDownloadBackup = async () => {
    setBackingUp(true)
    try {
      const res = await fetch('/api/admin/backup', {
        headers: {
          'x-requester-role': currentUser?.role || ''
        }
      })
      if (!res.ok) {
        throw new Error('Yedek indirilemedi.')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `hd-studio-backup-${getLocalDateString()}.db`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      addToast('Veritabanı yedeği başarıyla indirildi.', 'success')
    } catch (err) {
      console.error(err)
      addToast(err.message || 'Yedekleme sırasında hata oluştu.', 'error')
    } finally {
      setBackingUp(false)
    }
  }

  const handleRestoreBackup = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    showConfirm('UYARI: Yedek veritabanını geri yüklemek mevcut tüm verilerinizi tamamen sıfırlayıp seçilen yedekteki verilerle değiştirecektir! Devam etmek istediğinizden emin misiniz?', async () => {
      setRestoring(true)
      const formData = new FormData()
      formData.append('file', file)

      try {
        const res = await fetch('/api/admin/backup', {
          method: 'POST',
          headers: {
            'x-requester-role': currentUser?.role || ''
          },
          body: formData
        })
        const data = await res.json()
        if (res.ok) {
          addToast('Veritabanı başarıyla geri yüklendi! Lütfen sayfayı yenileyin.', 'success')
          fetchLogs()
        } else {
          addToast(data.error || 'Yedek geri yüklenemedi.', 'error')
        }
      } catch (err) {
        console.error(err)
        addToast('Bağlantı hatası oluştu.', 'error')
      } finally {
        setRestoring(false)
        e.target.value = ''
      }
    })
  }

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/logs', {
        headers: {
          'x-requester-role': currentUser?.role || '',
          'x-requester-id': currentUser?.id || ''
        }
      })
      if (res.ok) {
        const data = await res.json()
        setLogs(data)
      } else {
        const err = await res.json()
        addToast(err.error || 'Sistem günlükleri yüklenemedi.', 'error')
      }
    } catch (err) {
      console.error(err)
      addToast('Bağlantı hatası oluştu.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectAll = () => {
    if (selectedLogIds.length === filteredLogs.length) {
      setSelectedLogIds([])
    } else {
      setSelectedLogIds(filteredLogs.map(log => log.id))
    }
  }

  const handleDeleteSelected = async () => {
    if (selectedLogIds.length === 0) return

    const confirmMsg = `Seçilen ${selectedLogIds.length} sistem günlük kaydını kalıcı olarak silmek istediğinizden emin misiniz?`

    const deleteAction = async () => {
      setDeleting(true)
      try {
        const res = await fetch('/api/admin/logs', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'x-requester-role': currentUser?.role || ''
          },
          body: JSON.stringify({ ids: selectedLogIds })
        })

        if (res.ok) {
          const data = await res.json()
          addToast(`${data.count} günlük kaydı başarıyla silindi.`, 'success')
          setSelectedLogIds([])
          setSelectionMode(false)
          fetchLogs()
        } else {
          const err = await res.json()
          addToast(err.error || 'Günlükler silinemedi.', 'error')
        }
      } catch (err) {
        console.error(err)
        addToast('Bağlantı hatası oluştu.', 'error')
      } finally {
        setDeleting(false)
      }
    }

    if (showConfirm) {
      showConfirm(confirmMsg, deleteAction)
    } else {
      if (confirm(confirmMsg)) {
        deleteAction()
      }
    }
  }

  useEffect(() => {
    fetchLogs()
    if (currentUser?.role === 'admin') {
      fetchKasaTime()
    }
  }, [])

  function formatLogMessage(log) {
    const user = `<strong class="text-violet-400 font-bold">${log.username}</strong>`
    let prev = {}
    try {
      prev = JSON.parse(log.previousData || '{}')
    } catch (e) {}

    const action = log.actionType
    const model = log.modelName

    if (model === 'Customer') {
      const name = prev.name || 'Bilinmeyen Müşteri'
      if (action === 'INSERT') return `${user} yeni bir müşteri ekledi: <span class="text-white font-medium">"${name}"</span>`
      if (action === 'UPDATE') return `${user} <span class="text-white font-medium">"${name}"</span> müşterisinin bilgilerini güncelledi.`
      if (action === 'DELETE') return `${user} <span class="text-white font-medium">"${name}"</span> müşterisini sildi.`
    }

    if (model === 'Cari') {
      const name = prev.name || 'Bilinmeyen Cari'
      if (action === 'INSERT') return `${user} yeni bir cari hesap ekledi: <span class="text-white font-medium">"${name}"</span>`
      if (action === 'UPDATE') return `${user} <span class="text-white font-medium">"${name}"</span> cari hesabının bilgilerini güncelledi.`
      if (action === 'DELETE') return `${user} <span class="text-white font-medium">"${name}"</span> cari hesabını sildi.`
    }

    if (model === 'Project') {
      const name = prev.name || 'Bilinmeyen Çalışma'
      if (action === 'INSERT') return `${user} yeni bir çalışma (proje) oluşturdu: <span class="text-white font-medium">"${name}"</span>`
      if (action === 'UPDATE') {
        const stageStr = prev.stage ? ` (Aşama: "${prev.stage}")` : ''
        return `${user} <span class="text-white font-medium">"${name}"</span> çalışmasını güncelledi${stageStr}.`
      }
      if (action === 'DELETE') return `${user} <span class="text-white font-medium">"${name}"</span> çalışmasını sildi.`
    }

    if (model === 'Finance') {
      const amount = prev.amount ? `${new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(prev.amount)}` : 'Belirsiz tutarda'
      const type = prev.type === 'GELIR' ? 'gelir' : 'gider'
      const desc = prev.description ? ` ("${prev.description}")` : ''
      
      if (action === 'INSERT') return `${user} kasaya yeni bir <span class="text-emerald-400 font-semibold">${type}</span> işlemi ekledi: <span class="text-white font-semibold">${amount}</span>${desc}`
      if (action === 'UPDATE') return `${user} kasadaki bir finansal işlemi güncelledi: <span class="text-white font-semibold">${amount}</span>${desc}`
      if (action === 'DELETE') return `${user} kasadan bir <span class="text-rose-400 font-semibold">${type}</span> işlemini sildi: <span class="text-white font-semibold">${amount}</span>${desc}`
    }

    if (model === 'Equipment') {
      const name = prev.name || 'Bilinmeyen Ekipman'
      if (action === 'INSERT') return `${user} envantere yeni bir ekipman ekledi: <span class="text-white font-medium">"${name}"</span>`
      if (action === 'UPDATE') {
        const statusMap = { OFIS: 'Ofiste', SET: 'Sette', BAKIM: 'Bakımda' }
        const statusStr = prev.status ? ` (Durum: "${statusMap[prev.status] || prev.status}")` : ''
        return `${user} <span class="text-white font-medium">"${name}"</span> ekipmanının durumunu güncelledi${statusStr}.`
      }
      if (action === 'DELETE') return `${user} <span class="text-white font-medium">"${name}"</span> ekipmanını envanterden sildi.`
    }

    if (model === 'Employee') {
      const name = prev.name || 'Bilinmeyen Çalışan'
      if (action === 'INSERT') return `${user} sisteme yeni bir çalışan ekledi: <span class="text-white font-medium">"${name}"</span>`
      if (action === 'UPDATE') return `${user} <span class="text-white font-medium">"${name}"</span> çalışanının bilgilerini güncelledi.`
      if (action === 'DELETE') return `${user} <span class="text-white font-medium">"${name}"</span> çalışanını sildi.`
    }

    if (model === 'WorkLog') {
      const dateStr = prev.date ? new Date(prev.date).toLocaleDateString('tr-TR') : ''
      const empName = prev.employee?.name || 'Çalışan'
      const typeStr = prev.type ? ` (${prev.type === 'TAM' ? 'Tam Gün' : prev.type === 'YARIM' ? 'Yarım Gün' : 'Uzaktan'})` : ''
      
      if (action === 'INSERT') return `${user} <span class="text-white font-medium">${empName}</span> için yevmiye kaydı ekledi: <span class="text-gray-300 font-semibold">${dateStr}${typeStr}</span>`
      if (action === 'UPDATE') {
        const statusStr = prev.status ? ` (Ödeme: ${prev.status === 'ODENDI' ? 'Ödendi' : 'Ödenmedi'})` : ''
        return `${user} <span class="text-white font-medium">${empName}</span> çalışanının yevmiye kaydını güncelledi: <span class="text-gray-300 font-semibold">${dateStr}${statusStr}</span>`
      }
      if (action === 'DELETE') return `${user} <span class="text-white font-medium">${empName}</span> çalışanının <span class="text-gray-300 font-semibold">${dateStr}</span> tarihli yevmiye kaydını sildi.`
    }

    return `${user} <span class="text-gray-400 font-semibold">${model}</span> üzerinde <span class="text-white font-bold">${action}</span> işlemi yaptı (ID: ${log.modelId}).`
  }

  const filteredLogs = logs.filter(log => {
    const message = formatLogMessage(log).toLowerCase()
    const username = log.username.toLowerCase()
    const model = log.modelName.toLowerCase()
    const query = searchTerm.toLowerCase()
    
    const matchesSearch = message.includes(query) || username.includes(query) || model.includes(query)
    const matchesModel = filterModel === 'ALL' || log.modelName === filterModel
    const matchesAction = filterAction === 'ALL' || log.actionType === filterAction

    return matchesSearch && matchesModel && matchesAction
  })

  const getActionBadgeColor = (action) => {
    switch (action) {
      case 'INSERT':
        return 'border-emerald-500/20 text-emerald-400 bg-emerald-950/10'
      case 'UPDATE':
        return 'border-violet-500/20 text-violet-400 bg-violet-950/10'
      case 'DELETE':
        return 'border-rose-500/20 text-rose-400 bg-rose-950/10'
      default:
        return 'border-gray-500/20 text-gray-400 bg-gray-950/10'
    }
  }

  const getModelNameTurkish = (m) => {
    const names = {
      Customer: 'Müşteri',
      Cari: 'Cari Hesap',
      Project: 'Çalışma (Proje)',
      Finance: 'Finans / Kasa',
      Equipment: 'Ekipman',
      Employee: 'Çalışan',
      WorkLog: 'Yevmiye Kaydı'
    }
    return names[m] || m
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight glow-text text-white">Sistem Günlükleri (Logs)</h2>
          <p className="text-gray-400 mt-1">Sistem üzerinde gerçekleşen tüm veri değişim işlemlerinin detaylı kronolojisi.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {selectionMode ? (
            <div className="flex flex-wrap gap-2 items-center">
              <button
                type="button"
                onClick={handleSelectAll}
                className="px-3.5 py-2 bg-violet-600/20 hover:bg-violet-600/35 border border-violet-500/20 text-violet-300 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                {selectedLogIds.length === filteredLogs.length && filteredLogs.length > 0 ? 'Seçimi Kaldır' : 'Tümünü Seç'}
              </button>
              <button
                type="button"
                onClick={handleDeleteSelected}
                disabled={selectedLogIds.length === 0 || deleting}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-lg shadow-rose-600/20"
              >
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Seçilenleri Sil ({selectedLogIds.length})</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectionMode(false)
                  setSelectedLogIds([])
                }}
                className="px-3.5 py-2 border border-violet-500/15 text-gray-300 hover:text-white hover:bg-violet-950/20 rounded-xl text-xs font-bold cursor-pointer transition"
              >
                Seçimi Kapat
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setSelectionMode(true)}
              className="px-3.5 py-2 border border-rose-500/20 hover:border-rose-500/40 bg-rose-950/15 hover:bg-rose-950/25 text-rose-400 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Kayıtları Sil (Seçenekli)</span>
            </button>
          )}

          <button
            type="button"
            onClick={fetchLogs}
            disabled={loading}
            className="p-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-violet-600/20 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="text-xs font-bold uppercase tracking-wider hidden sm:inline">Yenile</span>
          </button>
        </div>
      </div>

      {/* Yedekleme & Geri Yükleme Paneli */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 rounded-2xl glass-card border border-violet-500/10">
        <div className="space-y-2 text-left">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Database className="w-5 h-5 text-violet-400" />
            <span>Sistem Veritabanı Yedekle (Backup)</span>
          </h3>
          <p className="text-xs text-gray-400 leading-relaxed">
            Mevcut veritabanınızı tek tıkla SQLite formatında yedekleyin. İndirilen yedek dosyasını güvenli bir yerde saklamanız önerilir.
          </p>
          <button
            type="button"
            onClick={handleDownloadBackup}
            disabled={backingUp}
            className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-xs font-bold text-white rounded-xl transition cursor-pointer shadow-lg shadow-violet-600/15"
          >
            {backingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>Yedeği İndir (.db)</span>
          </button>
        </div>

        <div className="space-y-2 text-left border-t md:border-t-0 md:border-l border-violet-500/10 pt-4 md:pt-0 md:pl-6">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Upload className="w-5 h-5 text-amber-400" />
            <span>Yedekten Geri Yükle (Restore)</span>
          </h3>
          <p className="text-xs text-gray-400 leading-relaxed">
            Daha önce indirdiğiniz bir `.db` yedek dosyasını yükleyerek tüm verileri geri yükleyebilirsiniz. <strong className="text-rose-400">Dikkat: Mevcut veriler silinir!</strong>
          </p>
          <div className="relative">
            <input
              type="file"
              accept=".db"
              onChange={handleRestoreBackup}
              disabled={restoring}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
            />
            <button
              type="button"
              disabled={restoring}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-xs font-bold text-white rounded-xl transition cursor-pointer shadow-lg shadow-amber-600/15"
            >
              {restoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              <span>Yedek Dosyası Seç (.db)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Günlük Kasa Bildirim Ayarları */}
      {currentUser?.role === 'admin' && (
        <div className="p-6 rounded-2xl glass-card border border-violet-500/10 flex flex-col md:flex-row gap-6 items-center justify-between text-left">
          <div className="space-y-2 text-left flex-1">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Bell className="w-5 h-5 text-violet-400 animate-pulse" />
              <span>Otomatik Kasa Bildirimi Ayarı</span>
            </h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Her gün belirlediğiniz saatte güncel kasa durumunu (gelir, gider ve net bakiye özetini) yöneticilere Discord, Telegram ve mobil Web Push bildirimleri olarak gönderir. (Vercel Cron ile entegredir).
            </p>
          </div>

          <form onSubmit={handleSaveKasaTime} className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="relative flex items-center">
              <Clock className="absolute left-3 w-4 h-4 text-violet-400 pointer-events-none" />
              <input
                type="time"
                required
                value={kasaTime}
                onChange={(e) => setKasaTime(e.target.value)}
                className="pl-9 pr-4 py-2.5 rounded-xl bg-violet-950/20 border border-violet-500/10 text-white focus:outline-none focus:border-violet-500 cursor-pointer text-xs font-bold font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={savingTime}
              className="px-4 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-xs font-bold text-white rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-lg shadow-violet-600/15"
            >
              {savingTime ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Kaydet
            </button>

            <button
              type="button"
              onClick={handleTestKasaNotification}
              disabled={testingKasa}
              className="px-4 py-2.5 bg-[#1b1406] hover:bg-amber-950/20 text-amber-400 border border-amber-500/20 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5"
            >
              {testingKasa ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Şimdi Test Et
            </button>
          </form>
        </div>
      )}

      <div className="p-4 rounded-2xl glass-card border border-violet-500/10 flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Kullanıcı veya işlem ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs pl-10 pr-4 py-2.5 rounded-xl bg-violet-950/20 border border-violet-500/10 text-white focus:outline-none focus:border-violet-500/40 focus:bg-violet-950/30 transition"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 w-full md:w-auto justify-end">
          {/* Model Filter */}
          <select
            value={filterModel}
            onChange={(e) => setFilterModel(e.target.value)}
            className="text-xs px-3 py-2.5 rounded-xl bg-violet-950/20 border border-violet-500/10 text-gray-300 focus:outline-none focus:border-violet-500 transition cursor-pointer"
          >
            <option value="ALL">Tüm Veri Tipleri</option>
            <option value="Customer">Müşteri İşlemleri</option>
            <option value="Cari">Cari Hesap İşlemleri</option>
            <option value="Project">Çalışma İşlemleri</option>
            <option value="Finance">Finans/Kasa İşlemleri</option>
            <option value="Equipment">Ekipman İşlemleri</option>
            <option value="Employee">Çalışan İşlemleri</option>
            <option value="WorkLog">Yevmiye İşlemleri</option>
          </select>

          {/* Action Filter */}
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="text-xs px-3 py-2.5 rounded-xl bg-violet-950/20 border border-violet-500/10 text-gray-300 focus:outline-none focus:border-violet-500 transition cursor-pointer"
          >
            <option value="ALL">Tüm İşlem Tipleri</option>
            <option value="INSERT">Sadece Ekleme (INSERT)</option>
            <option value="UPDATE">Sadece Güncelleme (UPDATE)</option>
            <option value="DELETE">Sadece Silme (DELETE)</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="p-6 rounded-2xl glass-card space-y-4">
        {loading ? (
          <div className="py-24 flex justify-center items-center">
            <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-24 text-gray-500 text-sm">
            Eşleşen sistem günlük kaydı bulunamadı.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-violet-500/10 text-xs text-gray-400 uppercase tracking-wider font-bold">
                  {selectionMode && <th className="p-4 w-12 text-center">Seç</th>}
                  <th className="p-4">Kullanıcı</th>
                  <th className="p-4">İşlem</th>
                  <th className="p-4">Açıklama</th>
                  <th className="p-4">Veri Tipi</th>
                  <th className="p-4 text-right">Tarih / Saat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-violet-500/5 text-xs">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-violet-950/5 transition duration-150">
                    {selectionMode && (
                      <td className="p-4 text-center whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedLogIds.includes(log.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedLogIds(prev => [...prev, log.id])
                            } else {
                              setSelectedLogIds(prev => prev.filter(id => id !== log.id))
                            }
                          }}
                          className="w-4 h-4 rounded border-violet-500/30 bg-violet-950/20 text-violet-600 focus:ring-violet-500/50 cursor-pointer"
                        />
                      </td>
                    )}
                    {/* User */}
                    <td className="p-4 font-semibold text-white whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-violet-400" />
                        <span>{log.username}</span>
                      </div>
                    </td>

                    {/* Action Type */}
                    <td className="p-4 whitespace-nowrap">
                      <span className={`px-2.5 py-0.5 rounded text-[10px] font-black border ${getActionBadgeColor(log.actionType)}`}>
                        {log.actionType}
                      </span>
                    </td>

                    {/* Description */}
                    <td className="p-4 text-gray-300 leading-relaxed font-medium min-w-[300px]">
                      <div dangerouslySetInnerHTML={{ __html: formatLogMessage(log) }} />
                    </td>

                    {/* Model Name */}
                    <td className="p-4 text-gray-400 font-semibold whitespace-nowrap">
                      {getModelNameTurkish(log.modelName)}
                    </td>

                    {/* Time */}
                    <td className="p-4 text-right text-gray-500 font-medium whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-gray-600" />
                        <span>
                          {new Date(log.createdAt).toLocaleDateString('tr-TR', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
