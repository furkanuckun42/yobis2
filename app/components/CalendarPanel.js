'use client'

import { useState, useEffect, useMemo } from 'react'
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Settings2, 
  RefreshCw, 
  X, 
  Copy,
  Trash2,
  Lock,
  Loader2,
  Clock,
  Plus
} from 'lucide-react'

export default function CalendarPanel({ currentUser, addToast, showConfirm }) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState(new Date())
  const [isDayModalOpen, setIsDayModalOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [isLocalhost, setIsLocalhost] = useState(true)
  const [activeCalTab, setActiveCalTab] = useState('hdstudio') // 'hdstudio' veya 'google'
  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState([])
  const [gcalConfig, setGcalConfig] = useState({
    clientId: '',
    clientSecret: '',
    exists: false,
    hasTokens: false
  })

  const isAdmin = currentUser?.role === 'admin'

  useEffect(() => {
    if (currentUser && currentUser.role !== 'admin') {
      setActiveCalTab('hdstudio')
    }
  }, [currentUser])

  // Get localized year and month string for Turkey timezone
  const getTurkeyMonthStr = (date) => {
    const trTime = new Date(date.getTime() + 3 * 60 * 60 * 1000)
    return `${trTime.getUTCFullYear()}-${String(trTime.getUTCMonth() + 1).padStart(2, '0')}`
  }

  // Fetch events & configuration
  const fetchEventsAndConfig = async () => {
    setLoading(true)
    try {
      const handleFetchRes = async (res) => {
        if (!res.ok) {
          try {
            const errData = await res.json()
            return Promise.reject(new Error(errData.error || `HTTP error ${res.status}`))
          } catch {
            return Promise.reject(new Error(`HTTP error ${res.status}`))
          }
        }
        return res.json()
      }

      const [eventsResult, configResult] = await Promise.allSettled([
        fetch('/api/events', {
          headers: {
            'x-requester-id': currentUser?.id || '',
            'x-requester-role': currentUser?.role || ''
          }
        }).then(handleFetchRes),
        fetch('/api/auth/google/config').then(handleFetchRes)
      ])

      if (eventsResult.status === 'fulfilled') {
        setEvents(eventsResult.value)
      } else {
        console.error('Etkinlik yükleme hatası:', eventsResult.reason)
        addToast('Takvim etkinlikleri yüklenemedi.', 'error')
      }

      if (configResult.status === 'fulfilled') {
        const configJson = configResult.value
        setGcalConfig({
          clientId: configJson.clientId || '',
          clientSecret: '',
          exists: configJson.exists,
          hasTokens: configJson.hasTokens
        })
      } else {
        console.error('Google config yükleme hatası:', configResult.reason)
      }
    } catch (err) {
      console.error('Takvim verisi yükleme hatası:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEventsAndConfig()
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname
      setIsLocalhost(hostname === 'localhost' || hostname === '127.0.0.1')
    }
  }, [])

  // Check URL parameters for OAuth redirect results
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('gcal') === 'success') {
      addToast('Google hesabı yetkilendirmesi başarıyla tamamlandı! Artık takviminizi senkronize edebilirsiniz.', 'success')
      window.history.replaceState({}, document.title, window.location.pathname)
      fetchEventsAndConfig()
    } else if (params.get('gcal') === 'error') {
      const details = params.get('details') || params.get('msg') || ''
      addToast('Google yetkilendirme hatası: ' + decodeURIComponent(details), 'error')
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [])

  // Process and memoize events
  const processedEvents = useMemo(() => {
    return events.map(e => {
      const parsedDate = new Date(e.date)
      return {
        ...e,
        parsedDate,
        dayVal: parsedDate.getDate(),
        monthVal: parsedDate.getMonth(),
        yearVal: parsedDate.getFullYear()
      }
    })
  }, [events])

  // Filter events for the selected day based on active tab
  const selectedDayEvents = useMemo(() => {
    if (!selectedDay) return []
    const sDay = selectedDay.getDate()
    const sMonth = selectedDay.getMonth()
    const sYear = selectedDay.getFullYear()
    return processedEvents.filter(e => {
      if (activeCalTab === 'google' && e.type !== 'google') return false
      if (activeCalTab === 'hdstudio' && e.type === 'google') return false
      return e.dayVal === sDay && 
             e.monthVal === sMonth && 
             e.yearVal === sYear
    })
  }, [processedEvents, selectedDay, activeCalTab])

  // Google API Settings Save
  const handleSaveConfig = async (e) => {
    e.preventDefault()
    if (!gcalConfig.clientId || !gcalConfig.clientSecret) {
      addToast('Lütfen hem Client ID hem de Client Secret alanlarını doldurun!', 'warning')
      return
    }

    try {
      const res = await fetch('/api/auth/google/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: gcalConfig.clientId,
          clientSecret: gcalConfig.clientSecret
        })
      })

      if (res.ok) {
        addToast('Google API ayarları kaydedildi! Şimdi hesabınızı yetkilendirebilirsiniz.', 'success')
        fetchEventsAndConfig()
      } else {
        const err = await res.json()
        addToast(err.error || 'Ayarlar kaydedilemedi.', 'error')
      }
    } catch (err) {
      console.error(err)
      addToast('Ayarlar kaydedilirken bağlantı hatası oluştu.', 'error')
    }
  }

  // Google OAuth Authorization Trigger
  const handleAuthorizeGoogle = async () => {
    try {
      const res = await fetch('/api/auth/google/auth-url')
      const json = await res.json()
      if (res.ok && json.url) {
        window.location.href = json.url
      } else {
        addToast(json.error || 'Google yetkilendirme bağlantısı alınamadı.', 'error')
      }
    } catch (err) {
      console.error(err)
      addToast('Bağlantı hatası oluştu.', 'error')
    }
  }

  // Google Calendar Synchronization
  const handleSyncCalendar = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/auth/google/sync', { method: 'POST' })
      const json = await res.json()
      if (res.ok) {
        addToast(`Google Takvim başarıyla senkronize edildi! ${json.count} etkinlik güncellendi.`, 'success')
        fetchEventsAndConfig()
      } else {
        addToast(json.error || 'Senkronizasyon başarısız oldu. Lütfen hesabı yeniden yetkilendirin.', 'error')
      }
    } catch (err) {
      console.error(err)
      addToast('Google Takvim senkronizasyonunda ağ hatası oluştu.', 'error')
    } finally {
      setSyncing(false)
    }
  }

  // Copy Google Event to HD Studio
  const handleCopyEvent = async (ev) => {
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-requester-role': currentUser?.role || ''
        },
        body: JSON.stringify({
          title: ev.title,
          date: ev.date,
          time: ev.time || 'Tüm Gün',
          type: 'meeting'
        })
      })

      if (res.ok) {
        addToast(`"${ev.title}" başarıyla HD Studio takvimine kopyalandı.`, 'success')
        fetchEventsAndConfig()
      } else {
        const err = await res.json()
        addToast(err.error || 'Kopyalama başarısız oldu.', 'error')
      }
    } catch (err) {
      console.error(err)
      addToast('Kopyalama sırasında bir hata oluştu.', 'error')
    }
  }

  // Delete Copied HD Studio Event
  const handleDeleteEvent = async (evId, evTitle) => {
    showConfirm(`"${evTitle}" etkinliğini silmek istediğinizden emin misiniz?`, async () => {
      try {
        const res = await fetch(`/api/events?id=${evId}`, {
          method: 'DELETE',
          headers: {
            'x-requester-role': currentUser?.role || ''
          }
        })

        if (res.ok) {
          addToast('Etkinlik başarıyla silindi.', 'success')
          fetchEventsAndConfig()
        } else {
          const err = await res.json()
          addToast(err.error || 'Etkinlik silinemedi.', 'error')
        }
      } catch (err) {
        console.error(err)
        addToast('Bağlantı hatası oluştu.', 'error')
      }
    })
  }

  // Month navigation helpers
  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  const getDaysInMonth = (date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    return new Date(year, month + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    // 0 is Sunday, we want 0 to be Monday, so we convert it
    let firstDay = new Date(year, month, 1).getDay()
    return firstDay === 0 ? 6 : firstDay - 1
  }

  const monthNames = [
    "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", 
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
  ]

  const daysOfWeek = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']

  // Calendar Day Rendering
  const memoizedCalendarDays = useMemo(() => {
    const daysCount = getDaysInMonth(currentDate)
    const firstDay = getFirstDayOfMonth(currentDate)
    const days = []
    const today = new Date()

    // Empty spaces for padding
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-20 border border-violet-500/5"></div>)
    }

    // Days in month
    for (let day = 1; day <= daysCount; day++) {
      const thisDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
      const isToday = 
        day === today.getDate() && 
        currentDate.getMonth() === today.getMonth() && 
        currentDate.getFullYear() === today.getFullYear()

      const isSelected = 
        selectedDay &&
        day === selectedDay.getDate() && 
        currentDate.getMonth() === selectedDay.getMonth() && 
        currentDate.getFullYear() === selectedDay.getFullYear()

      // Filter events of this day (google/hdstudio tabs)
      const dayEvents = processedEvents.filter(e => {
        if (activeCalTab === 'google' && e.type !== 'google') return false
        if (activeCalTab === 'hdstudio' && e.type === 'google') return false

        return e.dayVal === day && 
               e.monthVal === currentDate.getMonth() && 
               e.yearVal === currentDate.getFullYear()
      })

      days.push(
        <button 
          key={`day-${day}`} 
          onClick={() => {
            setSelectedDay(thisDate)
            setIsDayModalOpen(true)
          }}
          className={`h-20 p-2 border border-violet-500/5 flex flex-col items-start justify-between text-xs font-semibold transition-all relative ${
            isSelected 
              ? 'bg-violet-600/35 text-white border-violet-500/40 shadow-inner' 
              : isToday 
                ? 'border border-violet-500/40 text-violet-400 bg-violet-950/10' 
                : 'text-gray-300 hover:bg-violet-950/20'
          }`}
        >
          <span className={`text-[11px] px-1.5 py-0.5 rounded-md ${isToday ? 'bg-violet-600/20 font-black' : ''}`}>{day}</span>
          
          {dayEvents.length > 0 && (
            <>
              {/* Desktop view: full tags */}
              <div className="hidden md:flex w-full flex-col gap-0.5 mt-1">
                {dayEvents.slice(0, 2).map((ev, index) => {
                  let colorClass = 'bg-violet-500/10 text-violet-300 border-violet-500/20'
                  if (ev.type === 'equipment') colorClass = 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                  if (ev.type === 'project') colorClass = 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                  if (ev.type === 'meeting') colorClass = 'bg-sky-500/10 text-sky-300 border-sky-500/20'
                  if (ev.type === 'task') colorClass = 'bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/20'
                  return (
                    <span 
                      key={index} 
                      className={`w-full text-[9px] px-1 py-0.5 rounded border text-left truncate font-bold uppercase tracking-wider block ${colorClass}`}
                      title={ev.title}
                    >
                      {ev.title}
                    </span>
                  )
                })}
                {dayEvents.length > 2 && (
                  <span className="text-[8px] text-gray-500 font-bold self-end pr-1">
                    +{dayEvents.length - 2} daha
                  </span>
                )}
              </div>

              {/* Mobile view: small color-coded dots */}
              <div className="flex md:hidden w-full justify-center gap-1 mt-1.5 flex-wrap">
                {dayEvents.slice(0, 4).map((ev, index) => {
                  let dotColor = 'bg-violet-500 shadow-[0_0_4px_rgba(139,92,246,0.5)]'
                  if (ev.type === 'equipment') dotColor = 'bg-amber-500 shadow-[0_0_4px_rgba(245,158,11,0.5)]'
                  if (ev.type === 'project') dotColor = 'bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.5)]'
                  if (ev.type === 'meeting') dotColor = 'bg-sky-500 shadow-[0_0_4px_rgba(14,165,233,0.5)]'
                  if (ev.type === 'task') dotColor = 'bg-fuchsia-500 shadow-[0_0_4px_rgba(217,70,239,0.5)]'
                  return (
                    <span 
                      key={index} 
                      className={`w-1.5 h-1.5 rounded-full block ${dotColor}`}
                      title={ev.title}
                    ></span>
                  )
                })}
                {dayEvents.length > 4 && (
                  <span className="text-[7px] text-gray-500 font-bold leading-none self-center">
                    +
                  </span>
                )}
              </div>
            </>
          )}
        </button>
      )
    }

    return days
  }, [currentDate, selectedDay, processedEvents, activeCalTab])

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Title */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight glow-text text-white">Stüdyo Takvimi</h2>
          <p className="text-gray-400 mt-1">
            Çalışmalar, atanan görevler ve Google takvim etkinliklerinin birleşik takvimi.
          </p>
        </div>

        {/* Sync Controls for Admin */}
        {isAdmin && (
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowConfig(!showConfig)} 
              className={`p-2.5 rounded-xl border transition ${
                showConfig 
                  ? 'bg-violet-600 border-violet-500 text-white shadow-md' 
                  : 'bg-violet-950/20 border-violet-500/10 text-gray-400 hover:text-white'
              }`}
              title="Google Sync Ayarları"
            >
              <Settings2 className="w-4 h-4" />
            </button>
            <button 
              onClick={handleSyncCalendar} 
              disabled={syncing}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-lg shadow-violet-600/15 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span>Google Senkronize Et</span>
            </button>
          </div>
        )}
      </div>

      {/* Sync Credentials Config Panel */}
      {isAdmin && showConfig && (
        <form onSubmit={handleSaveConfig} className="p-5 bg-violet-950/25 border border-violet-500/20 rounded-2xl space-y-4 text-left animate-slide-in-top">
          <div>
            <h5 className="text-sm font-bold text-violet-300">Google Calendar API Entegrasyonu</h5>
            <p className="text-[11px] text-gray-400 mt-0.5">Google Developer Console üzerinden oluşturduğunuz OAuth2 istemci kimliklerini girin.</p>
          </div>

          {!isLocalhost && !gcalConfig.hasTokens && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl text-xs font-semibold leading-relaxed">
              ⚠️ Google Takvim yetkilendirmesi güvenlik kuralları gereği sadece sunucu bilgisayarı (
              <a href="http://localhost:3000" className="underline hover:text-amber-300" target="_blank" rel="noreferrer">
                http://localhost:3000
              </a>
              ) üzerinden yapılabilir. Lütfen bu işlemi stüdyonun çalıştığı ana bilgisayardan tamamlayın. Yetkilendirme bittiğinde diğer tüm cihazlarda da senkronizasyon çalışacaktır.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-400 block mb-1 font-medium">Google Client ID</label>
              <input 
                type="password" 
                value={gcalConfig.clientId}
                onChange={(e) => setGcalConfig({ ...gcalConfig, clientId: e.target.value })}
                placeholder="OAuth Client ID..." 
                className="w-full text-xs px-3.5 py-2 rounded-xl bg-violet-950/40 border border-violet-500/20 text-white focus:outline-none focus:border-violet-500" 
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1 font-medium">Google Client Secret</label>
              <input 
                type="password" 
                value={gcalConfig.clientSecret}
                onChange={(e) => setGcalConfig({ ...gcalConfig, clientSecret: e.target.value })}
                placeholder="OAuth Client Secret..." 
                className="w-full text-xs px-3.5 py-2 rounded-xl bg-violet-950/40 border border-violet-500/20 text-white focus:outline-none focus:border-violet-500" 
              />
            </div>
          </div>
          
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-violet-500/10">
            <p className="text-[10px] text-gray-500">
              Kimlik bilgileriniz yerel veritabanında güvenle saklanır.
            </p>
            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Bilgileri Kaydet
              </button>
              {gcalConfig.exists && (
                <button
                  type="button"
                  onClick={handleAuthorizeGoogle}
                  className={`px-4 py-2 text-xs font-bold rounded-xl border transition cursor-pointer ${
                    gcalConfig.hasTokens
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      : 'bg-amber-600 hover:bg-amber-500 text-white'
                  }`}
                >
                  {gcalConfig.hasTokens ? 'Hesap Yetkilendirildi ✓' : 'Google Hesabını Yetkilendir'}
                </button>
              )}
            </div>
          </div>
        </form>
      )}

      {/* Main Calendar View Container */}
      <div className="p-6 rounded-2xl glass-card space-y-4">
        {/* Header Controls */}
        <div className="flex justify-between items-center pb-2 border-b border-violet-500/10">
          <div className="flex items-center gap-3">
            <h4 className="font-extrabold text-lg text-white">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h4>
            
            {/* View Filter tabs (Google vs Local) */}
            <div className="flex bg-violet-950/40 p-0.5 rounded-lg border border-violet-500/10">
              <button
                type="button"
                onClick={() => setActiveCalTab('hdstudio')}
                className={`px-3 py-1 rounded text-xs font-bold transition cursor-pointer ${
                  activeCalTab === 'hdstudio'
                    ? 'bg-violet-600 text-white shadow-sm glow-purple'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                HD Studio
              </button>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setActiveCalTab('google')}
                  className={`px-3 py-1 rounded text-xs font-bold transition cursor-pointer ${
                    activeCalTab === 'google'
                      ? 'bg-violet-600 text-white shadow-sm glow-purple'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Google Takvim
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button 
              onClick={prevMonth} 
              className="p-1.5 hover:bg-violet-950/40 rounded-xl text-gray-400 hover:text-white transition cursor-pointer border border-transparent hover:border-violet-500/10"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button 
              onClick={nextMonth} 
              className="p-1.5 hover:bg-violet-950/40 rounded-xl text-gray-400 hover:text-white transition cursor-pointer border border-transparent hover:border-violet-500/10"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Calendar Days Matrix */}
        {loading ? (
          <div className="py-32 flex justify-center items-center">
            <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1 text-center">
            {daysOfWeek.map((day, idx) => (
              <div key={idx} className="text-xs font-extrabold text-violet-400 py-2 border-b border-violet-500/5">{day}</div>
            ))}
            {memoizedCalendarDays}
          </div>
        )}
      </div>

      {/* Day details modal */}
      {isDayModalOpen && selectedDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl glass-card border border-violet-500/20 shadow-2xl p-6 relative animate-scale-in text-left space-y-4">
            <button
              onClick={() => setIsDayModalOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-xl bg-violet-950/40 border border-violet-500/10 text-gray-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 pb-2 border-b border-violet-500/10">
              <CalendarIcon className="w-5 h-5 text-violet-400" />
              <h3 className="font-bold text-lg text-white">
                {selectedDay.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' })}
              </h3>
            </div>

            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
              {selectedDayEvents.length === 0 ? (
                <div className="text-center py-12 text-gray-500 text-sm">
                  Bu tarihte planlanmış bir etkinlik, görev veya teslimat bulunmuyor.
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedDayEvents.map((ev) => {
                    let badgeStyles = 'border-violet-500/10 text-violet-400 bg-violet-950/10'
                    let categoryName = 'Takvim Etkinliği'
                    if (ev.type === 'equipment') {
                      badgeStyles = 'border-amber-500/10 text-amber-400 bg-amber-950/10'
                      categoryName = 'Envanter/Ekipman'
                    }
                    if (ev.type === 'project') {
                      badgeStyles = 'border-emerald-500/10 text-emerald-400 bg-emerald-950/10'
                      categoryName = 'Proje Teslimatı'
                    }
                    if (ev.type === 'meeting') {
                      badgeStyles = 'border-sky-500/10 text-sky-400 bg-sky-950/10'
                      categoryName = 'Toplantı / Özel Gün'
                    }
                    if (ev.type === 'task') {
                      badgeStyles = 'border-fuchsia-500/10 text-fuchsia-400 bg-fuchsia-950/10'
                      categoryName = 'Atanmış Görev'
                    }
                    
                    return (
                      <div key={ev.id} className={`p-4 rounded-xl border flex flex-col sm:flex-row justify-between sm:items-center gap-3 transition-all ${badgeStyles}`}>
                        <div className="flex items-start gap-3">
                          <div className="w-2 h-2 rounded-full bg-current mt-1.5 flex-shrink-0"></div>
                          <div>
                            <span className="font-bold text-white block text-sm leading-tight">{ev.title}</span>
                            <span className="text-[10px] text-gray-400 block mt-1 uppercase tracking-wide">
                              Kategori: {categoryName}
                            </span>
                            {ev.time && (
                              <span className="text-[10px] text-violet-300 font-semibold block mt-0.5">
                                Saat: {ev.time}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 self-end sm:self-center">
                          {/* Copy Google Event Button */}
                          {isAdmin && ev.type === 'google' && (
                            <button
                              onClick={() => handleCopyEvent(ev)}
                              className="px-2.5 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-bold text-[10px] flex items-center gap-1 transition cursor-pointer shadow-md shadow-violet-600/15"
                              title="HD Studio'ya Kopyala"
                            >
                              <Copy className="w-3 h-3" />
                              <span>Kopyala</span>
                            </button>
                          )}
                          
                          {/* Delete Local Event Button */}
                          {isAdmin && ev.type !== 'google' && ev.type !== 'project' && ev.type !== 'task' && (
                            <button
                              onClick={() => handleDeleteEvent(ev.id, ev.title)}
                              className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg transition cursor-pointer"
                              title="Etkinliği Sil"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
