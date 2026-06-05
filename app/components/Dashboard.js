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
  Users,
  Check
} from 'lucide-react'

export default function Dashboard({ triggerRefresh, currentUser, setActiveTab, onAuthError, addToast }) {
  const [data, setData] = useState(null)
  // Aylık Müşteri Dönem Seçimi
  const [selectedMetricMonth, setSelectedMetricMonth] = useState(() => {
    const now = new Date(Date.now() + 3 * 60 * 60 * 1000)
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
  })
  const [loading, setLoading] = useState(true)
  
  // Weather State
  const [weather, setWeather] = useState(null)
  const [weatherLoading, setWeatherLoading] = useState(true)
  const [weatherError, setWeatherError] = useState(false)

  // Dashboard Upcoming Tab State
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



  // Yaklaşan Google etkinliklerini filtrele (bugün veya gelecekte olanlar, tarihe göre sıralı)
  const upcomingGoogleEvents = useMemo(() => {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    return processedEvents
      .filter(e => e.type === 'google' && e.parsedDate >= todayStart)
      .sort((a, b) => a.parsedDate - b.parsedDate)
      .slice(0, 10)
  }, [processedEvents])

  // Bugünün Gündemi etkinlikleri (Çalışmalar ve Görevler)
  const todayEvents = useMemo(() => {
    const today = new Date()
    const tDay = today.getDate()
    const tMonth = today.getMonth()
    const tYear = today.getFullYear()
    return processedEvents.filter(e => {
      // Sadece proje, görev veya toplantıları listele (Google etkinliklerini de gösterelim)
      return e.dayVal === tDay && 
             e.monthVal === tMonth && 
             e.yearVal === tYear
    })
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
        fetch(`/api/dashboard?month=${selectedMetricMonth}`).then(handleFetchRes),
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
  }, [triggerRefresh, selectedMetricMonth])

  useEffect(() => {
    fetchWeather()
  }, [])

  useEffect(() => {
    if (currentUser && currentUser.role !== 'admin') {
      setActiveUpcomingTab('hdstudio')
    }
  }, [currentUser])

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



  // Metrik Dönem Navigasyonu
  const prevMetricMonth = () => {
    setSelectedMetricMonth(prev => {
      const [y, m] = prev.split('-').map(Number)
      const d = new Date(y, m - 2, 1)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    })
  }

  const nextMetricMonth = () => {
    setSelectedMetricMonth(prev => {
      const [y, m] = prev.split('-').map(Number)
      const d = new Date(y, m, 1)
      const nowTR = new Date(Date.now() + 3 * 60 * 60 * 1000)
      const currentStr = `${nowTR.getUTCFullYear()}-${String(nowTR.getUTCMonth() + 1).padStart(2, '0')}`
      const newStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (newStr > currentStr) return prev // Gelecek aya gitme
      return newStr
    })
  }

  const isCurrentMetricMonth = (() => {
    const nowTR = new Date(Date.now() + 3 * 60 * 60 * 1000)
    const currentStr = `${nowTR.getUTCFullYear()}-${String(nowTR.getUTCMonth() + 1).padStart(2, '0')}`
    return selectedMetricMonth === currentStr
  })()

  const metricMonthLabel = (() => {
    const [y, m] = selectedMetricMonth.split('-').map(Number)
    const names = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']
    return `${names[m - 1]} ${y}`
  })()



  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (currentUser?.role === 'freelancer') {
    const activeTasks = data?.activeTasks || []
    const metrics = data?.metrics || { activeTasksCount: 0, completedTasksCount: 0 }

    return (
      <div className="space-y-8 animate-fade-in text-left">
        {/* Page Title */}
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight glow-text text-white">
            {getGreeting()}, <span className="bg-gradient-to-r from-violet-400 to-purple-300 bg-clip-text text-transparent">{getDisplayName()}</span> 👋
          </h2>
          <p className="text-gray-400 mt-1">
            Size atanan aktif görevleri buradan görüntüleyip yönetebilirsiniz. İyi çalışmalar!
          </p>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div 
            onClick={() => setActiveTab && setActiveTab('tasks')}
            className="p-6 rounded-2xl glass-card relative overflow-hidden group cursor-pointer hover:border-violet-500/30 transition-all"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-violet-600/10 to-transparent rounded-full blur-2xl group-hover:scale-125 transition-all"></div>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-gray-400">Aktif Görevlerim</p>
                <h3 className="text-3xl font-bold mt-2 text-white">{metrics.activeTasksCount ?? 0}</h3>
              </div>
              <div className="p-3 bg-violet-500/10 rounded-xl text-violet-400 border border-violet-500/20">
                <Clock className="w-5 h-5" />
              </div>
            </div>
            <div className="text-xs text-violet-400/80 mt-4 font-semibold">Devam eden veya bekleyen görevler</div>
          </div>

          <div 
            onClick={() => setActiveTab && setActiveTab('tasks')}
            className="p-6 rounded-2xl glass-card relative overflow-hidden group cursor-pointer hover:border-emerald-500/30 transition-all"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-600/10 to-transparent rounded-full blur-2xl group-hover:scale-125 transition-all"></div>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-gray-400">Tamamlanan Görevlerim</p>
                <h3 className="text-3xl font-bold mt-2 text-emerald-400">{metrics.completedTasksCount ?? 0}</h3>
              </div>
              <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
                <Check className="w-5 h-5" />
              </div>
            </div>
            <div className="text-xs text-emerald-400/80 mt-4 font-semibold">Başarıyla tamamlanmış görevler</div>
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

        {/* Middle Grid: Tasks & Weather */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active Assigned Tasks List */}
          <div className="p-6 rounded-2xl glass-card lg:col-span-2 space-y-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-violet-500/10">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-violet-400" />
                  <h4 className="font-bold text-base text-white">Aktif Atanan Görevler</h4>
                </div>
                <span className="text-xs px-2.5 py-1 bg-violet-500/10 text-violet-400 border border-violet-500/20 rounded-full font-semibold">
                  {activeTasks.length} Görev
                </span>
              </div>

              <div className="mt-4 space-y-3 max-h-[350px] overflow-y-auto pr-1">
                {activeTasks.length === 0 ? (
                  <div className="text-center py-16 text-gray-500 text-sm">
                    Üzerinize atanmış aktif bir görev bulunmuyor.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activeTasks.map((task) => {
                      const daysLeft = task.dueDate 
                        ? Math.ceil((new Date(task.dueDate) - new Date()) / (1000 * 60 * 60 * 24))
                        : null

                      return (
                        <div 
                          key={task.id} 
                          className="p-4 rounded-xl border border-violet-500/10 bg-violet-950/5 hover:border-violet-500/20 transition-all text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-white">{task.title}</span>
                              <span className={`px-2 py-0.5 rounded-[4px] text-[9px] font-bold border uppercase ${
                                task.status === 'Devam Ediyor'
                                  ? 'border-violet-500/20 text-violet-400 bg-violet-950/10'
                                  : 'border-amber-500/20 text-amber-400 bg-amber-950/10'
                              }`}>
                                {task.status}
                              </span>
                            </div>
                            {task.description && (
                              <p className="text-gray-400 text-[11px] line-clamp-2 leading-relaxed">
                                {task.description}
                              </p>
                            )}
                            {task.project && (
                              <div className="text-[10px] text-violet-400 font-medium">
                                Çalışma: {task.project.name} {task.project.customer ? `(${task.project.customer.name})` : ''}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                            {task.dueDate && (
                              <div className="text-right">
                                <span className="text-gray-500 block text-[10px] uppercase">Son Tarih</span>
                                <span className="font-semibold text-gray-300">
                                  {new Date(task.dueDate).toLocaleDateString('tr-TR')}
                                </span>
                                {daysLeft !== null && (
                                  <span className={`block text-[9px] ${
                                    daysLeft > 0 
                                      ? 'text-violet-400' 
                                      : daysLeft === 0 
                                        ? 'text-rose-400 font-bold' 
                                        : 'text-rose-500'
                                  }`}>
                                    {daysLeft > 0 
                                      ? `(${daysLeft} gün kaldı)` 
                                      : daysLeft === 0 
                                        ? '(Bugün!)' 
                                        : `(${Math.abs(daysLeft)} gün gecikti)`}
                                  </span>
                                )}
                              </div>
                            )}
                            
                            <button
                              onClick={() => setActiveTab && setActiveTab('tasks')}
                              className="px-3 py-1.5 bg-violet-600/25 hover:bg-violet-600 text-violet-300 hover:text-white border border-violet-500/20 rounded-lg font-bold transition cursor-pointer"
                            >
                              Yönet
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-violet-500/5 flex justify-end">
              <button
                onClick={() => setActiveTab && setActiveTab('tasks')}
                className="text-violet-400 hover:text-violet-300 font-bold flex items-center gap-0.5 text-xs transition cursor-pointer"
              >
                <span>Tüm Görevleri Gör</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Weather Widget */}
          <div className="p-6 rounded-2xl glass-card flex flex-col justify-between h-fit lg:h-full">
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

            <div className="text-[10px] text-gray-500 text-right mt-4">
              {weather?.isOfflineData 
                ? 'Çevrimdışı (Yedek Veri)' 
                : weather?.isFallback 
                  ? 'wttr.in API (Yedek)' 
                  : 'Open-Meteo API'}
            </div>
          </div>
        </div>
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

          {/* Metric 2 — Aylık Müşteri Beklenen Ödeme */}
          <div 
            className="p-6 rounded-2xl glass-card relative overflow-hidden group hover:border-violet-500/30 transition-all"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-violet-600/10 to-transparent rounded-full blur-2xl group-hover:scale-125 transition-all"></div>
            <div className="flex justify-between items-start">
              <div
                onClick={() => setActiveTab && setActiveTab('monthlyCustomers')}
                className="cursor-pointer flex-1"
              >
                <p className="text-sm font-medium text-gray-400">Beklenen Aylık Ödeme</p>
                <h3 className="text-3xl font-bold mt-2 text-white">
                  {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(metrics.monthlyEstimatedRevenue)}
                </h3>
              </div>
              <div className="p-3 bg-violet-500/10 rounded-xl text-violet-400 border border-violet-500/20">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            {/* Dönem Seçici */}
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-violet-500/10">
              <button
                onClick={(e) => { e.stopPropagation(); prevMetricMonth() }}
                className="p-1 rounded-lg hover:bg-violet-950/40 text-violet-400 transition cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-violet-400">{metricMonthLabel}</span>
              <button
                onClick={(e) => { e.stopPropagation(); nextMetricMonth() }}
                disabled={isCurrentMetricMonth}
                className="p-1 rounded-lg hover:bg-violet-950/40 text-violet-400 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="text-[10px] text-gray-500 mt-1">
              {metrics.monthlyCardCount ?? '-'} müşteri kartı
            </div>
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

        {/* Bugünün Gündemi */}
        <div className="p-6 rounded-2xl glass-card md:col-span-2 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-3 border-b border-violet-500/10">
              <Clock className="w-5 h-5 text-violet-400" />
              <h4 className="font-bold text-base text-white">Bugünün Gündemi</h4>
            </div>

            <div className="space-y-2 mt-4 max-h-[220px] overflow-y-auto pr-1">
              {todayEvents.length === 0 ? (
                <div className="text-center py-12 text-gray-500 text-sm">
                  Bugün için planlanmış bir çalışma teslimatı veya görev bulunmuyor.
                </div>
              ) : (
                <div className="space-y-2">
                  {todayEvents.map((ev) => {
                    let badgeStyles = 'border-violet-500/10 text-violet-400 bg-violet-950/10'
                    let label = 'Etkinlik'
                    if (ev.type === 'project') {
                      badgeStyles = 'border-emerald-500/10 text-emerald-400 bg-emerald-950/10'
                      label = 'Teslimat'
                    }
                    if (ev.type === 'task') {
                      badgeStyles = 'border-fuchsia-500/10 text-fuchsia-400 bg-fuchsia-950/10'
                      label = 'Görev'
                    }
                    if (ev.type === 'meeting') {
                      badgeStyles = 'border-sky-500/10 text-sky-400 bg-sky-950/10'
                      label = 'Toplantı'
                    }
                    if (ev.type === 'equipment') {
                      badgeStyles = 'border-amber-500/10 text-amber-400 bg-amber-950/10'
                      label = 'Envanter'
                    }

                    return (
                      <div key={ev.id} className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-all ${badgeStyles}`}>
                        <div className="flex items-center gap-2.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-current"></div>
                          <div>
                            <span className="font-bold text-white block text-sm leading-tight">{ev.title}</span>
                            <span className="text-[10px] text-gray-400 block mt-0.5 uppercase tracking-wide">
                              Tür: {label}
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] uppercase font-bold tracking-wider opacity-85 whitespace-nowrap bg-black/30 px-2 py-0.5 rounded">
                          {ev.time || 'Tüm Gün'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-violet-500/5 flex justify-between items-center text-xs">
            <span className="text-gray-400">Toplam {todayEvents.length} gündem maddesi</span>
            <button
              onClick={() => setActiveTab && setActiveTab('calendar')}
              className="text-violet-400 hover:text-violet-300 font-bold flex items-center gap-0.5 transition cursor-pointer"
            >
              <span>Tüm Takvimi Aç</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
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
