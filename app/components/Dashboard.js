'use client'

import { useState, useEffect, useMemo } from 'react'
import Charts from '@/app/components/Charts'
import { 
  Projector, 
  Wallet, 
  CalendarDays, 
  TrendingUp, 
  UserMinus, 
  Sun, 
  Cloud, 
  CloudRain, 
  Snowflake, 
  RefreshCw, 
  Settings2, 
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  X,
  Briefcase,
  Users
} from 'lucide-react'

export default function Dashboard({ triggerRefresh, currentUser, setActiveTab, onAuthError, addToast }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  
  // Weather State
  const [weather, setWeather] = useState(null)
  const [weatherLoading, setWeatherLoading] = useState(true)
  const [weatherError, setWeatherError] = useState(false)

  // Calendar State
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState(new Date()) // Seçilen gün
  const [isDayModalOpen, setIsDayModalOpen] = useState(false) // Gün detay modalı açık mı?
  const [syncing, setSyncing] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [isLocalhost, setIsLocalhost] = useState(true)
  const [activeCalTab, setActiveCalTab] = useState('google') // 'google' veya 'hdstudio'
  const [activeUpcomingTab, setActiveUpcomingTab] = useState('hdstudio') // 'hdstudio' veya 'google'
  const [gcalConfig, setGcalConfig] = useState({
    clientId: '',
    clientSecret: '',
    exists: false,
    hasTokens: false
  })

  // Google Calendar ve Sistem Etkinlikleri (Veritabanından dinamik gelir)
  const [events, setEvents] = useState([])
  const [unpaidSalary, setUnpaidSalary] = useState(0)

  // Tarih nesnelerini performansı optimize etmek için memoize et
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

  // Seçilen güne ait etkinlikleri filtrele
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

  // Yaklaşan Google etkinliklerini filtrele (bugün veya gelecekte olanlar, tarihe göre sıralı)
  const upcomingGoogleEvents = useMemo(() => {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    return processedEvents
      .filter(e => e.type === 'google' && e.parsedDate >= todayStart)
      .sort((a, b) => a.parsedDate - b.parsedDate)
      .slice(0, 10)
  }, [processedEvents])

  // Fetch Dashboard Data & Events & Config
  const fetchDashboardData = async () => {
    try {
      const handleFetchRes = async (res) => {
        if (res.status === 401) {
          if (onAuthError) onAuthError()
          return Promise.reject(new Error('Unauthorized'))
        }
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

      const [dashResult, eventsResult, configResult, worklogsResult] = await Promise.allSettled([
        fetch('/api/dashboard').then(handleFetchRes),
        fetch('/api/events').then(handleFetchRes),
        fetch('/api/auth/google/config').then(handleFetchRes),
        fetch('/api/worklogs').then(handleFetchRes)
      ])
      
      if (dashResult.status === 'fulfilled') {
        setData(dashResult.value)
      } else {
        console.error('Dashboard metrik yükleme hatası:', dashResult.reason)
      }
      
      if (eventsResult.status === 'fulfilled') {
        setEvents(eventsResult.value)
      } else {
        console.error('Etkinlik yükleme hatası:', eventsResult.reason)
      }

      if (worklogsResult.status === 'fulfilled') {
        const unpaid = worklogsResult.value
          .filter(log => log.status === 'ODENMEDI')
          .reduce((sum, log) => sum + log.amount, 0)
        setUnpaidSalary(unpaid)
      } else {
        console.error('Yevmiye yükleme hatası:', worklogsResult.reason)
      }

      if (configResult.status === 'fulfilled') {
        const configJson = configResult.value
        setGcalConfig({
          clientId: configJson.clientId || '',
          clientSecret: '', // Gizlilik için şifreyi geri vermiyoruz
          exists: configJson.exists,
          hasTokens: configJson.hasTokens
        })
      } else {
        console.error('Google config yükleme hatası:', configResult.reason)
      }
    } catch (err) {
      console.error('Dashboard genel veri yükleme hatası:', err)
    } finally {
      setLoading(false)
    }
  }

  // Fetch Konya Weather
  const fetchWeather = async () => {
    setWeatherLoading(true)
    setWeatherError(false)
    try {
      // Yerel sunucu API'miz üzerinden istek atıyoruz (CORS engellerini aşmak için)
      const res = await fetch('/api/weather')
      const json = await res.json()
      if (res.ok && json.current_weather) {
        setWeather(json.current_weather)
      } else {
        setWeatherError(true)
      }
    } catch (err) {
      // Çevrimdışı hatasını korkutucu olmayan bir şekilde logla
      console.warn('Hava durumu API bağlantı hatası (Çevrimdışı olabilirsiniz):', err.message)
      setWeatherError(true)
    } finally {
      setWeatherLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [triggerRefresh])

  useEffect(() => {
    fetchWeather()
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname
      setIsLocalhost(hostname === 'localhost' || hostname === '127.0.0.1')
    }
  }, [])

  useEffect(() => {
    if (currentUser && currentUser.role !== 'admin') {
      setActiveCalTab('hdstudio')
      setActiveUpcomingTab('hdstudio')
    }
  }, [currentUser])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('gcal') === 'success') {
      addToast('Google hesabı yetkilendirmesi başarıyla tamamlandı! Artık takviminizi senkronize edebilirsiniz.', 'success')
      window.history.replaceState({}, document.title, window.location.pathname)
      fetchDashboardData()
    } else if (params.get('gcal') === 'error') {
      const details = params.get('details') || params.get('msg') || ''
      addToast('Google yetkilendirme hatası: ' + decodeURIComponent(details), 'error')
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [])

  // Google API Yapılandırmasını Kaydet
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
        fetchDashboardData()
      } else {
        const err = await res.json()
        addToast(err.error || 'Ayarlar kaydedilemedi.', 'error')
      }
    } catch (err) {
      console.error(err)
      addToast('Ayarlar kaydedilirken bağlantı hatası oluştu.', 'error')
    }
  }

  // Google OAuth Onay Yönlendirmesini Başlat
  const handleAuthorizeGoogle = async () => {
    try {
      const res = await fetch('/api/auth/google/auth-url')
      const json = await res.json()
      if (res.ok && json.url) {
        window.location.href = json.url // Google yetkilendirme sayfasına yönlendir
      } else {
        addToast(json.error || 'Google yetkilendirme bağlantısı alınamadı.', 'error')
      }
    } catch (err) {
      console.error(err)
      addToast('Bağlantı hatası oluştu.', 'error')
    }
  }

  // Gerçek Google Calendar Senkronizasyon İsteği
  const handleSyncCalendar = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/auth/google/sync', { method: 'POST' })
      const json = await res.json()
      if (res.ok) {
        addToast(`Google Takvim başarıyla senkronize edildi! ${json.count} etkinlik güncellendi.`, 'success')
        fetchDashboardData()
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

  // Weather Helpers
  const getWeatherIcon = (code) => {
    if (code === 0) return <Sun className="w-8 h-8 text-amber-400" />
    if ([1, 2, 3].includes(code)) return <Cloud className="w-8 h-8 text-gray-400" />
    if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return <CloudRain className="w-8 h-8 text-blue-400" />
    if ([71, 73, 75, 85, 86].includes(code)) return <Snowflake className="w-8 h-8 text-sky-300" />
    return <Cloud className="w-8 h-8 text-gray-400" />
  }

  const getWeatherText = (code) => {
    if (code === 0) return 'Güneşli'
    if ([1, 2, 3].includes(code)) return 'Parçalı Bulutlu'
    if ([45, 48].includes(code)) return 'Sisli'
    if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return 'Yağmurlu'
    if ([71, 73, 75, 85, 86].includes(code)) return 'Karlı'
    return 'Bulutlu'
  }

  // Zamana göre selamlama
  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour >= 5 && hour < 12) return 'Günaydın'
    if (hour >= 12 && hour < 17) return 'Tünaydın'
    if (hour >= 17 && hour < 21) return 'İyi Akşamlar'
    return 'İyi Geceler'
  }

  // Kullanıcı gösterim ismi
  const getDisplayName = () => {
    if (!currentUser) return ''
    return currentUser.displayName || currentUser.username
  }

  // Calendar Helpers
  const getDaysInMonth = (date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    return new Date(year, month + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    // 0: Pazar, 1: Pazartesi
    let day = new Date(year, month, 1).getDay()
    return day === 0 ? 6 : day - 1 // Pazartesi ile başlat
  }

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  const monthNames = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
  ]

  const daysOfWeek = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']

  const memoizedCalendarDays = useMemo(() => {
    const daysCount = getDaysInMonth(currentDate)
    const firstDay = getFirstDayOfMonth(currentDate)
    const days = []
    const today = new Date()

    // Boş günler
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-10"></div>)
    }

    // Ayın günleri
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

      // Bu güne ait etkinlikleri filtrele
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
          className={`h-10 flex flex-col items-center justify-center text-xs font-semibold rounded-lg transition-all relative ${
            isSelected 
              ? 'bg-violet-600 text-white glow-purple' 
              : isToday 
                ? 'border border-violet-500/40 text-violet-400 bg-violet-950/10' 
                : 'text-gray-300 hover:bg-violet-950/20'
          }`}
        >
          <span>{day}</span>
          {dayEvents.length > 0 && (
            <div className="flex gap-0.5 mt-0.5 justify-center">
              {dayEvents.slice(0, 3).map((ev, index) => {
                let dotColor = 'bg-violet-400'
                if (ev.type === 'equipment') dotColor = 'bg-amber-400'
                if (ev.type === 'project') dotColor = 'bg-emerald-400'
                if (ev.type === 'meeting') dotColor = 'bg-sky-400'
                return <span key={index} className={`w-1 h-1 rounded-full ${dotColor}`}></span>
              })}
            </div>
          )}
        </button>
      )
    }

    return days
  }, [currentDate, selectedDay, activeCalTab, processedEvents])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  const metrics = data?.metrics || {
    activeProjectsCount: 0,
    netCashStatus: 0,
    monthlyEstimatedRevenue: 0,
    netCariStatus: 0
  }

  const upcomingProjects = data?.upcomingProjects || []

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page Title */}
      <div>
        <h2 className="text-3xl font-extrabold tracking-tight glow-text text-white">
          {getGreeting()}, <span className="bg-gradient-to-r from-violet-400 to-purple-300 bg-clip-text text-transparent">{getDisplayName()}</span> 👋
        </h2>
        <p className="text-gray-400 mt-1">
          {currentUser?.role === 'admin'
            ? 'Stüdyonun genel gidişatı, teslimatları ve finansal durumu.'
            : 'Bildirimlerini ve görevleri kontrol etmeyi unutma! İyi Çalışmalar.'}
        </p>
      </div>

      {/* Metrics Grid — Admin: 4 kart | Personel: 3 kart */}
      {currentUser?.role === 'admin' ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Metric 1 — Net Kasa */}
          <div 
            onClick={() => setActiveTab && setActiveTab('finance')}
            className="p-6 rounded-2xl glass-card relative overflow-hidden group cursor-pointer hover:border-emerald-500/30 transition-all"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-600/10 to-transparent rounded-full blur-2xl group-hover:scale-125 transition-all"></div>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-gray-400">Net Kasa Durumu</p>
                <h3 className={`text-3xl font-bold mt-2 ${metrics.netCashStatus >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(metrics.netCashStatus)}
                </h3>
              </div>
              <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
                <Wallet className="w-5 h-5" />
              </div>
            </div>
            <div className="text-xs text-emerald-400/80 mt-4 font-semibold">Gelir - Gider dengesi</div>
          </div>

          {/* Metric 2 — Aylık Gelir */}
          <div 
            onClick={() => setActiveTab && setActiveTab('monthlyCustomers')}
            className="p-6 rounded-2xl glass-card relative overflow-hidden group cursor-pointer hover:border-violet-500/30 transition-all"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-violet-600/10 to-transparent rounded-full blur-2xl group-hover:scale-125 transition-all"></div>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-gray-400">Aylık Tahmini Gelir</p>
                <h3 className="text-3xl font-bold mt-2 text-white">
                  {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(metrics.monthlyEstimatedRevenue)}
                </h3>
              </div>
              <div className="p-3 bg-violet-500/10 rounded-xl text-violet-400 border border-violet-500/20">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <div className="text-xs text-violet-400/80 mt-4 font-semibold">Aylık müşteriler toplamı</div>
          </div>

          {/* Metric 3 — Toplam Cari Borç */}
          <div 
            onClick={() => setActiveTab && setActiveTab('caris')}
            className="p-6 rounded-2xl glass-card relative overflow-hidden group cursor-pointer hover:border-rose-500/30 transition-all"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-rose-600/10 to-transparent rounded-full blur-2xl group-hover:scale-125 transition-all"></div>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-gray-400">Toplam Cari Borç</p>
                <h3 className="text-3xl font-bold mt-2 text-rose-400">
                  {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(metrics.totalBorc || 0)}
                </h3>
              </div>
              <div className="p-3 bg-rose-500/10 rounded-xl text-rose-400 border border-rose-500/20">
                <UserMinus className="w-5 h-5" />
              </div>
            </div>
            <div className="text-xs text-rose-400/80 mt-4 font-semibold">Toplam cari borç</div>
          </div>

          {/* Metric 4 — Personel Ödemeleri */}
          <div 
            onClick={() => setActiveTab && setActiveTab('worklogs')}
            className="p-6 rounded-2xl glass-card relative overflow-hidden group cursor-pointer hover:border-rose-500/30 transition-all"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-rose-600/10 to-transparent rounded-full blur-2xl group-hover:scale-125 transition-all"></div>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-gray-400">Personel Ödemeleri</p>
                <h3 className="text-3xl font-bold mt-2 text-rose-400">
                  {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(unpaidSalary)}
                </h3>
              </div>
              <div className="p-3 bg-rose-500/10 rounded-xl text-rose-400 border border-rose-500/20">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <div className="text-xs text-rose-400/80 mt-4 font-semibold">Toplam yevmiye borcu</div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Personel: Aktif Projeler, Alacak ve Tarih */}
          <div className="p-6 rounded-2xl glass-card relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-violet-600/10 to-transparent rounded-full blur-2xl group-hover:scale-125 transition-all"></div>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-gray-400">Aktif Çalışma Sayısı</p>
                <h3 className="text-3xl font-bold mt-2 text-white">{metrics.activeProjectsCount}</h3>
              </div>
              <div className="p-3 bg-violet-500/10 rounded-xl text-violet-400 border border-violet-500/20">
                <Projector className="w-5 h-5" />
              </div>
            </div>
            <div className="text-xs text-violet-400/80 mt-4 font-semibold">Devam eden işler</div>
          </div>

          <div className="p-6 rounded-2xl glass-card relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-rose-600/10 to-transparent rounded-full blur-2xl group-hover:scale-125 transition-all"></div>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-gray-400">Beklenen Ödeme (Alacak)</p>
                <h3 className="text-3xl font-bold mt-2 text-rose-400">
                  {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(unpaidSalary)}
                </h3>
              </div>
              <div className="p-3 bg-rose-500/10 rounded-xl text-rose-400 border border-rose-500/20">
                <Wallet className="w-5 h-5" />
              </div>
            </div>
            <div className="text-xs text-rose-400/80 mt-4 font-semibold">Hak edilen yevmiyeler</div>
          </div>

          <div className="p-6 rounded-2xl glass-card relative overflow-hidden group flex items-center gap-4">
            <div className="p-4 bg-violet-500/10 rounded-xl text-violet-400 border border-violet-500/10 shrink-0">
              <CalendarIcon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-400">Bugünün Tarihi</p>
              <h3 className="text-xl font-bold mt-1 text-white">
                {new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </h3>
            </div>
          </div>
        </div>
      )}



      {/* Middle Grid: Weather & Calendar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Weather Widget */}
        <div className="p-6 rounded-2xl glass-card flex flex-col justify-between">
          <div className="flex justify-between items-center pb-4 border-b border-violet-500/10">
            <div>
              <h4 className="font-bold text-base text-white">Konya</h4>
              <p className="text-xs text-gray-400">Anlık Hava Durumu</p>
            </div>
            <button 
              onClick={fetchWeather} 
              className="p-2 hover:bg-violet-950/40 rounded-lg text-violet-400 transition"
              title="Yenile"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {weatherLoading ? (
            <div className="py-12 flex justify-center items-center">
              <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : weather ? (
            <div className="py-6 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-4xl font-black text-white glow-text">
                  {Math.round(weather.temperature)}°C
                </span>
                <p className="text-sm text-gray-300 font-semibold">
                  {getWeatherText(weather.weathercode)}
                </p>
              </div>
              <div className="p-4 bg-violet-950/20 rounded-2xl border border-violet-500/10">
                {getWeatherIcon(weather.weathercode)}
              </div>
            </div>
          ) : (
            <div className="py-8 flex flex-col items-center justify-center text-center text-xs text-gray-500">
              <Cloud className="w-8 h-8 text-violet-500/40 mb-1" />
              <span>İnternet Bağlantısı Yok</span>
              <span className="text-[10px] text-gray-600 mt-1">Konya (Çevrimdışı Mod)</span>
            </div>
          )}

          <div className="text-[10px] text-gray-500 text-right">
            {weather?.isOfflineData 
              ? 'Çevrimdışı (Yedek Veri)' 
              : weather?.isFallback 
                ? 'wttr.in API (Yedek)' 
                : 'Open-Meteo API'}
          </div>
        </div>

        {/* Dynamic Calendar with Google Sync */}
        <div className="p-6 rounded-2xl glass-card md:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 pb-2">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-violet-400" />
                <h4 className="font-bold text-base text-white">
                  {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                </h4>
              </div>
              
              {/* Takvim Değiştirme Sekmeleri */}
              {currentUser?.role === 'admin' && (
                <div className="flex bg-violet-950/40 p-0.5 rounded-lg border border-violet-500/10">
                  <button
                    type="button"
                    onClick={() => setActiveCalTab('google')}
                    className={`px-2.5 py-1 rounded text-[10px] font-bold tracking-wider uppercase transition cursor-pointer ${
                      activeCalTab === 'google'
                        ? 'bg-violet-600 text-white shadow-sm glow-purple'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Google
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveCalTab('hdstudio')}
                    className={`px-2.5 py-1 rounded text-[10px] font-bold tracking-wider uppercase transition cursor-pointer ${
                      activeCalTab === 'hdstudio'
                        ? 'bg-violet-600 text-white shadow-sm glow-purple'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    HD Studio
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button onClick={prevMonth} className="p-1 hover:bg-violet-950/40 rounded-lg text-gray-400 hover:text-white transition">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button onClick={nextMonth} className="p-1 hover:bg-violet-950/40 rounded-lg text-gray-400 hover:text-white transition">
                <ChevronRight className="w-5 h-5" />
              </button>
              {currentUser?.role === 'admin' && (
                <>
                  <button 
                    onClick={() => setShowConfig(!showConfig)} 
                    className="p-1 hover:bg-violet-950/40 rounded-lg text-gray-400 hover:text-white transition"
                    title="Google Sync Ayarları"
                  >
                    <Settings2 className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={handleSyncCalendar} 
                    disabled={syncing}
                    className="ml-2 flex items-center gap-1 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-lg transition cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                    <span>Sync</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Sync Config panel */}
          {showConfig && (
            <form onSubmit={handleSaveConfig} className="p-4 bg-violet-950/20 border border-violet-500/20 rounded-xl space-y-3 text-left">
              <h5 className="text-xs font-bold text-violet-300">Google Calendar API Entegrasyonu</h5>
              {!isLocalhost && !gcalConfig.hasTokens && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg text-[11px] font-semibold leading-relaxed">
                  ⚠️ Google Takvim yetkilendirmesi güvenlik kuralları gereği sadece sunucu bilgisayarı (
                  <a href="http://localhost:3000" className="underline hover:text-amber-300">
                    http://localhost:3000
                  </a>
                  ) üzerinden yapılabilir. Lütfen bu işlemi stüdyonun çalıştığı ana bilgisayardan tamamlayın. Yetkilendirme bittiğinde mobil ve diğer cihazlarda da senkronizasyon çalışacaktır.
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-gray-400 block mb-1">Google Client ID</label>
                  <input 
                    type="password" 
                    value={gcalConfig.clientId}
                    onChange={(e) => setGcalConfig({ ...gcalConfig, clientId: e.target.value })}
                    placeholder="OAuth Client ID..." 
                    className="w-full text-xs px-2.5 py-1.5 rounded bg-violet-950/40 border border-violet-500/20 text-white focus:outline-none focus:border-violet-500" 
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 block mb-1">Google Client Secret</label>
                  <input 
                    type="password" 
                    value={gcalConfig.clientSecret}
                    onChange={(e) => setGcalConfig({ ...gcalConfig, clientSecret: e.target.value })}
                    placeholder="OAuth Client Secret..." 
                    className="w-full text-xs px-2.5 py-1.5 rounded bg-violet-950/40 border border-violet-500/20 text-white focus:outline-none focus:border-violet-500" 
                  />
                </div>
              </div>
              
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <p className="text-[10px] text-gray-500 max-w-sm">
                  Kimlik bilgileriniz yerel SQLite veritabanında güvenle saklanır.
                </p>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-lg transition cursor-pointer"
                  >
                    Bilgileri Kaydet
                  </button>
                  {gcalConfig.exists && (
                    <button
                      type="button"
                      onClick={handleAuthorizeGoogle}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition cursor-pointer ${
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

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {daysOfWeek.map((day, idx) => (
              <div key={idx} className="text-xs font-bold text-gray-500 py-1">{day}</div>
            ))}
            {memoizedCalendarDays}
          </div>

          {/* Günlük Detay Modalı (Takvime Tıklayınca Açılır) */}
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
                        if (ev.type === 'equipment') badgeStyles = 'border-amber-500/10 text-amber-400 bg-amber-950/10'
                        if (ev.type === 'project') badgeStyles = 'border-emerald-500/10 text-emerald-400 bg-emerald-950/10'
                        if (ev.type === 'meeting') badgeStyles = 'border-sky-500/10 text-sky-400 bg-sky-950/10'
                        if (ev.type === 'task') badgeStyles = 'border-fuchsia-500/10 text-fuchsia-400 bg-fuchsia-950/10'
                        
                        return (
                          <div key={ev.id} className={`p-3.5 rounded-xl border flex items-center justify-between text-xs transition-all ${badgeStyles}`}>
                            <div className="flex items-center gap-3">
                              <div className="w-2 h-2 rounded-full bg-current"></div>
                              <div>
                                <span className="font-semibold text-white block text-sm">{ev.title}</span>
                                <span className="text-[10px] text-gray-400 block mt-0.5 uppercase tracking-wide">
                                  Tür: {ev.type === 'project' ? 'Proje Teslimatı' : ev.type === 'task' ? 'Atanmış Görev' : 'Takvim Etkinliği'}
                                </span>
                              </div>
                            </div>
                            <span className="text-[10px] uppercase font-bold tracking-wider opacity-85 whitespace-nowrap bg-black/30 px-2 py-1 rounded">{ev.time || 'Tüm Gün'}</span>
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
      </div>

      {/* Bottom Section: Nearest Deliveries / Google Events */}
      <div className="p-6 rounded-2xl glass-card space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-violet-500/10">
          <h4 className="font-bold text-lg text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-violet-400" />
            <span>Yaklaşan Etkinlikler</span>
          </h4>

          {/* Sekmeler */}
          <div className="flex flex-wrap items-center gap-3">
            {currentUser?.role === 'admin' && (
              <div className="flex bg-violet-950/40 p-0.5 rounded-lg border border-violet-500/10">
                <button
                  type="button"
                  onClick={() => setActiveUpcomingTab('hdstudio')}
                  className={`px-3 py-1 rounded text-xs font-semibold transition cursor-pointer ${
                    activeUpcomingTab === 'hdstudio'
                      ? 'bg-violet-600 text-white shadow-sm glow-purple'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  HD Studio (Teslimatlar)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveUpcomingTab('google')}
                  className={`px-3 py-1 rounded text-xs font-semibold transition cursor-pointer ${
                    activeUpcomingTab === 'google'
                      ? 'bg-violet-600 text-white shadow-sm glow-purple'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Google Takvim
                </button>
              </div>
            )}

            <span className="text-xs px-2.5 py-1 bg-violet-500/10 text-violet-400 border border-violet-500/20 rounded-full font-semibold">
              {activeUpcomingTab === 'hdstudio' ? `${upcomingProjects.length} Çalışma` : `${upcomingGoogleEvents.length} Etkinlik`}
            </span>
          </div>
        </div>

        {activeUpcomingTab === 'hdstudio' ? (
          upcomingProjects.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm">
              Yaklaşan aktif bir çalışma teslimatı bulunamadı.
            </div>
          ) : (
            <div className="overflow-x-auto animate-fade-in">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-violet-500/10 text-xs text-gray-500 uppercase tracking-wider">
                    <th className="pb-3">Çalışma Adı</th>
                    <th className="pb-3">Müşteri</th>
                    <th className="pb-3">Aşama</th>
                    <th className="pb-3">Teslim Tarihi</th>
                  </tr>
                </thead>
                <tbody>
                  {upcomingProjects.map((project) => {
                    const daysLeft = Math.ceil((new Date(project.deliveryDate) - new Date()) / (1000 * 60 * 60 * 24))
                    let stageColor = 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                    if (project.stage === 'Teklif Aşamasında') stageColor = 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                    else if (project.stage === 'Devam Ediyor') stageColor = 'bg-violet-500/10 text-violet-400 border-violet-500/20'
                    else if (project.stage === 'Revize Bekliyor') stageColor = 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    else if (project.stage === 'Teslime Hazır') stageColor = 'bg-pink-500/10 text-pink-400 border-pink-500/20'
                    
                    return (
                      <tr key={project.id} className="border-b border-violet-500/5 hover:bg-violet-950/10 text-sm text-gray-300">
                        <td className="py-3.5 font-semibold text-white">{project.name}</td>
                        <td className="py-3.5">{project.customer?.name || 'Belirtilmemiş'}</td>
                        <td className="py-3.5">
                          <span className={`px-2 py-0.5 text-xs rounded border ${stageColor}`}>
                            {project.stage}
                          </span>
                        </td>
                        <td className="py-3.5 font-medium">
                          {new Date(project.deliveryDate).toLocaleDateString('tr-TR')}
                          {daysLeft > 0 ? (
                            <span className="ml-2 text-xs text-violet-400/80">({daysLeft} gün kaldı)</span>
                          ) : daysLeft === 0 ? (
                            <span className="ml-2 text-xs text-rose-400 font-bold">(Bugün!)</span>
                          ) : (
                            <span className="ml-2 text-xs text-rose-500">({Math.abs(daysLeft)} gün gecikti)</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          upcomingGoogleEvents.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm">
              Yaklaşan Google Takvim etkinliği bulunamadı.
            </div>
          ) : (
            <div className="overflow-x-auto animate-fade-in">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-violet-500/10 text-xs text-gray-500 uppercase tracking-wider">
                    <th className="pb-3">Etkinlik Adı</th>
                    <th className="pb-3">Tarih</th>
                    <th className="pb-3">Saat</th>
                    <th className="pb-3">Tür</th>
                  </tr>
                </thead>
                <tbody>
                  {upcomingGoogleEvents.map((ev) => {
                    const daysLeft = Math.ceil((new Date(ev.date) - new Date()) / (1000 * 60 * 60 * 24))
                    return (
                      <tr key={ev.id} className="border-b border-violet-500/5 hover:bg-violet-950/10 text-sm text-gray-300">
                        <td className="py-3.5 font-semibold text-white">{ev.title}</td>
                        <td className="py-3.5 font-medium">
                          {new Date(ev.date).toLocaleDateString('tr-TR')}
                          {daysLeft > 0 ? (
                            <span className="ml-2 text-xs text-violet-400/80">({daysLeft} gün kaldı)</span>
                          ) : daysLeft === 0 ? (
                            <span className="ml-2 text-xs text-rose-400 font-bold">(Bugün!)</span>
                          ) : (
                            <span className="ml-2 text-xs text-rose-500">({Math.abs(daysLeft)} gün geçti)</span>
                          )}
                        </td>
                        <td className="py-3.5">{ev.time || 'Tüm Gün'}</td>
                        <td className="py-3.5">
                          <span className="px-2 py-0.5 text-xs rounded border border-violet-500/20 bg-violet-500/10 text-violet-400 uppercase font-semibold">
                            Google
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  )
}
