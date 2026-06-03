'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Sidebar from '@/app/components/Sidebar'
import Dashboard from '@/app/components/Dashboard'
import Customers from '@/app/components/Customers'
import Projects from '@/app/components/Projects'
import Finance from '@/app/components/Finance'
import Users from '@/app/components/Users'
import Tasks from '@/app/components/Tasks'
import Caris from '@/app/components/Caris'
import Employees from '@/app/components/Employees'
import WorkLogs from '@/app/components/WorkLogs'
import ToastContainer from '@/app/components/Toast'
import { Menu, X, Sparkles, Bell, LogOut, Lock, Loader2, Search, KeyRound, User, ChevronDown, Eye, EyeOff, AlertTriangle } from 'lucide-react'

// Safe localStorage helper — no code runs at module level, only inside functions
const safeStorage = {
  getItem(key) {
    try { return localStorage.getItem(key) } catch (e) { return null }
  },
  setItem(key, value) {
    try { localStorage.setItem(key, value) } catch (e) {}
  },
  removeItem(key) {
    try { localStorage.removeItem(key) } catch (e) {}
  }
}

// installFetchInterceptor — called inside useEffect after hydration
function installFetchInterceptor() {
  if (typeof window === 'undefined' || window.__fetchInterceptorInstalled) return
  window.__fetchInterceptorInstalled = true
  const originalFetch = window.fetch
  window.fetch = async function(url, options) {
    options = options || {}
    try {
      const token = safeStorage.getItem('session_token') || window.__sessionToken
      if (token) {
        const urlStr = typeof url === 'string' ? url : (url && url.url) ? url.url : String(url)
        const isApi = urlStr.startsWith('/api') || urlStr.includes('/api/')
        if (isApi) {
          options.headers = Object.assign({}, options.headers, { 'Authorization': 'Bearer ' + token })
        }
      }
    } catch (e) {}
    return originalFetch.call(window, url, options)
  }
}
import SearchModal from '@/app/components/SearchModal'
import Logs from '@/app/components/Logs'
import MonthlyCustomers from '@/app/components/MonthlyCustomers'
import CalendarPanel from '@/app/components/CalendarPanel'

export default function Home() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchModalOpen, setSearchModalOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Auth & Session State
  const [currentUser, setCurrentUser] = useState(null)
  const [loggingIn, setLoggingIn] = useState(false)
  const [loginUsername, setLoginUsername] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')

  // PWA Web Push Notification States
  const [pushSupported, setPushSupported] = useState(false)
  const [isPushSubscribed, setIsPushSubscribed] = useState(false)
  const [subscribingPush, setSubscribingPush] = useState(false)

  // Profile Dropdown State
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false)
  const profileDropdownRef = useRef(null)
  const notificationsDropdownRef = useRef(null)

  // Password Change Modal State
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)

  // Notifications State
  const [notifications, setNotifications] = useState([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [shouldBlink, setShouldBlink] = useState(false)

  // Toast State
  const [toasts, setToasts] = useState([])

  // Inactivity Ref
  const lastActivityRef = useRef(Date.now())
  const lastSavedActivityRef = useRef(0)

  // Toast Yönetimi
  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5)
    setToasts(prev => [...prev, { id, message, type }])
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  // Custom Confirm Modal State
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: 'Onay Gerekiyor',
    message: '',
    onConfirm: null
  })

  const showConfirm = useCallback((message, onConfirm, title = 'Onay Gerekiyor') => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm()
        setConfirmModal(prev => ({ ...prev, isOpen: false }))
      }
    })
  }, [])

  // Close profile and notification dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target)) {
        setProfileDropdownOpen(false)
      }
      if (notificationsDropdownRef.current && !notificationsDropdownRef.current.contains(e.target)) {
        setShowNotifications(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Giriş Yapma İşlemi
  const handleLoginSubmit = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    setLoggingIn(true)
    setLoginError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-requested-with': 'XMLHttpRequest' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword })
      })

      const data = await res.json()
      
      if (res.ok) {
        setCurrentUser(data.user)
        if (typeof window !== 'undefined') {
          window.__sessionToken = data.token
        }
        safeStorage.setItem('currentUser', JSON.stringify(data.user))
        safeStorage.setItem('session_token', data.token)
        
        const now = Date.now()
        lastActivityRef.current = now
        lastSavedActivityRef.current = now
        safeStorage.setItem('lastActivity', now.toString())

        setActiveTab('dashboard')
        fetchNotifications()

        setTimeout(() => {
          checkAndAlertNewTasks()
        }, 1000)
      } else {
        setLoginError(data.error || 'Giriş yapılamadı.')
      }
    } catch (err) {
      console.error(err)
      setLoginError('Bağlantı hatası oluştu.')
    } finally {
      setLoggingIn(false)
    }
  }

  // Çıkış Yapma İşlemi
  const handleLogout = useCallback(async (reason) => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', headers: { 'x-requested-with': 'XMLHttpRequest' } })
    } catch (err) {
      console.error('Çıkış hatası:', err)
    }
    setCurrentUser(null)
    if (typeof window !== 'undefined') {
      window.__sessionToken = null
    }
    safeStorage.removeItem('currentUser')
    safeStorage.removeItem('lastActivity')
    safeStorage.removeItem('session_token')
    setNotifications([])
    setShowNotifications(false)
    setProfileDropdownOpen(false)
    setLoginUsername('')
    setLoginPassword('')
    if (reason === 'session_expired') {
      // Toast yerine login ekranında hata mesajı göster
      setLoginError('Hareketsizlik nedeniyle oturumunuz sonlandırıldı.')
    }
  }, [])

  // Şifre Değiştirme
  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      addToast('Yeni şifreler eşleşmiyor!', 'error')
      return
    }
    if (newPassword.length < 4) {
      addToast('Yeni şifre en az 4 karakter olmalıdır.', 'error')
      return
    }

    setChangingPassword(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-requested-with': 'XMLHttpRequest' },
        body: JSON.stringify({ currentPassword, newPassword })
      })

      const data = await res.json()
      if (res.ok) {
        addToast('Şifreniz başarıyla değiştirildi!', 'success')
        setPasswordModalOpen(false)
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        setShowCurrentPw(false)
        setShowNewPw(false)
      } else {
        addToast(data.error || 'Şifre değiştirilemedi.', 'error')
      }
    } catch (err) {
      console.error(err)
      addToast('Bağlantı hatası oluştu.', 'error')
    } finally {
      setChangingPassword(false)
    }
  }

  const triggerBlink = () => {
    setShouldBlink(true)
    setTimeout(() => {
      setShouldBlink(false)
    }, 3600)
  }

  // Okunmamış Bildirim Uyarısı
  const checkAndAlertNewTasks = async () => {
    try {
      const res = await fetch('/api/notifications', { headers: { 'x-requested-with': 'XMLHttpRequest' } })
      if (res.status === 401) {
        handleLogout('session_expired')
        return
      }
      if (res.ok) {
        const data = await res.json()
        const unreadCount = data.filter(n => !n.read).length
        if (unreadCount > 0) {
          triggerBlink()
        }
      }
    } catch (err) {
      console.error(err)
    }
  }

  // PWA Web Push Abonelik Durumu Kontrolü
  const checkPushSubscriptionStatus = async () => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPushSupported(false)
      return
    }
    setPushSupported(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      setIsPushSubscribed(!!sub)
    } catch (err) {
      console.error('Subscription status check failed:', err)
    }
  }

  // PWA Web Push Aboneliği Oluşturma (iOS Safari Uyumlu - Kullanıcı Etkileşimiyle)
  const subscribeToPushNotifications = async () => {
    if (!pushSupported || subscribingPush) return
    setSubscribingPush(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        addToast('Bildirim izni reddedildi. Lütfen tarayıcı ayarlarından bildirim izinlerini açın.', 'warning')
        setSubscribingPush(false)
        return
      }

      const reg = await navigator.serviceWorker.ready
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidPublicKey) {
        throw new Error('Sistem açık anahtarı (VAPID) bulunamadı.')
      }

      const urlBase64ToUint8Array = (base64String) => {
        const padding = '='.repeat((4 - base64String.length % 4) % 4)
        const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/')
        const rawData = window.atob(base64)
        const outputArray = new Uint8Array(rawData.length)
        for (let i = 0; i < rawData.length; ++i) {
          outputArray[i] = rawData.charCodeAt(i)
        }
        return outputArray
      }

      const subscribeOptions = {
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      }

      const subscription = await reg.pushManager.subscribe(subscribeOptions)
      
      const res = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
          'x-requester-id': currentUser?.id || '',
          'x-requester-role': currentUser?.role || ''
        },
        body: JSON.stringify({ subscription })
      })

      if (res.ok) {
        setIsPushSubscribed(true)
        addToast('Anlık bildirimler başarıyla etkinleştirildi! 🎉', 'success')
      } else {
        const data = await res.json()
        throw new Error(data.error || 'Abonelik kaydedilemedi.')
      }
    } catch (err) {
      console.error('Push subscription failed:', err)
      addToast(`Abonelik hatası: ${err.message}`, 'error')
    } finally {
      setSubscribingPush(false)
    }
  }

  // Bildirimleri Çekme
  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications', { headers: { 'x-requested-with': 'XMLHttpRequest' } })
      if (res.status === 401) {
        handleLogout('session_expired')
        return
      }
      if (res.ok) {
        const data = await res.json()
        setNotifications(data)
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Tekil Bildirimi Okundu Yap
  const handleMarkNotificationRead = async (notif) => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-requester-id': currentUser?.id || '',
          'x-requested-with': 'XMLHttpRequest'
        },
        body: JSON.stringify({ id: notif.id })
      })
      if (res.ok) {
        setNotifications(prev => 
          prev.map(n => n.id === notif.id ? { ...n, read: true } : n)
        )
      }
      
      // Bildirime tıklandığında ilgili sekmeyi aç
      if (notif.tab) {
        setActiveTab(notif.tab)
        setShowNotifications(false)
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Tüm Bildirimleri Okundu Yap
  const handleMarkAllNotificationsRead = async () => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-requester-id': currentUser?.id || '',
          'x-requested-with': 'XMLHttpRequest'
        },
        body: JSON.stringify({ readAll: true })
      })
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Okunmuş Tüm Bildirimleri Sil
  const handleClearReadNotifications = async () => {
    try {
      const res = await fetch('/api/notifications?clearRead=true', {
        method: 'DELETE',
        headers: { 
          'x-requester-id': currentUser?.id || '',
          'x-requested-with': 'XMLHttpRequest'
        }
      })
      if (res.ok) {
        setNotifications(prev => prev.filter(n => !n.read))
        addToast('Okunmuş bildirimler silindi.', 'success')
      } else {
        addToast('Bildirimler silinemedi.', 'error')
      }
    } catch (err) {
      console.error(err)
      addToast('Bağlantı hatası.', 'error')
    }
  }

  // 1. Session recovery on mount & PWA registration
  useEffect(() => {
    setMounted(true)
    installFetchInterceptor() // Install AFTER React hydration — safe for iOS Safari
    if (typeof window !== 'undefined') {
      const savedUser = safeStorage.getItem('currentUser')
      const savedActivity = safeStorage.getItem('lastActivity')
      const savedToken = safeStorage.getItem('session_token')
      
      if (savedToken) {
        window.__sessionToken = savedToken
      }
      
        let parsedUser = null
        let parsedActivity = 0
        try {
          parsedUser = savedUser ? JSON.parse(savedUser) : null
          parsedActivity = savedActivity ? parseInt(savedActivity) : 0
        } catch (e) {
          console.error('Failed to parse saved user or activity:', e)
          safeStorage.removeItem('currentUser')
          safeStorage.removeItem('lastActivity')
          safeStorage.removeItem('session_token')
          window.__sessionToken = null
        }
        
        if (parsedUser && parsedActivity && Date.now() - parsedActivity <= 7 * 24 * 60 * 60 * 1000) {
          setCurrentUser(parsedUser)
          lastActivityRef.current = parsedActivity
          lastSavedActivityRef.current = parsedActivity
          fetchNotifications()
          setTimeout(() => {
            checkAndAlertNewTasks()
          }, 1000)
        } else {
          safeStorage.removeItem('currentUser')
          safeStorage.removeItem('lastActivity')
          safeStorage.removeItem('session_token')
          window.__sessionToken = null
        }

      // Service Worker Kaydı (PWA için)
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
          .then(reg => console.log('Service Worker başarıyla kaydedildi:', reg.scope))
          .catch(err => console.error('Service Worker kaydı başarısız:', err))
      }
    }
  }, [])

  // 1.1 Kullanıcı değiştiğinde Push Abonelik durumunu kontrol et
  useEffect(() => {
    if (currentUser && currentUser.role === 'admin') {
      checkPushSubscriptionStatus()
    }
  }, [currentUser])

  // 2. Inactivity tracking & notifications polling
  useEffect(() => {
    if (!currentUser) return

    const resetTimer = () => {
      const now = Date.now()
      lastActivityRef.current = now
      // Throttling: Only write to localStorage at most once every 15 seconds to avoid UI stuttering/lag
      if (now - lastSavedActivityRef.current > 15000) {
        lastSavedActivityRef.current = now
        safeStorage.setItem('lastActivity', now.toString())
      }
    }

    // Hareketsizlik dinleyicileri
    window.addEventListener('mousemove', resetTimer)
    window.addEventListener('keydown', resetTimer)
    window.addEventListener('click', resetTimer)
    window.addEventListener('scroll', resetTimer)
    window.addEventListener('touchstart', resetTimer)

    // Hareketsizlik kontrolü (her 5 saniyede bir)
    const timeoutInterval = setInterval(() => {
      if (Date.now() - lastActivityRef.current > 30 * 60 * 1000) {
        handleLogout('session_expired')
      }
    }, 5000)

    // Bildirimleri polleme (her 30 saniyede bir)
    const pollInterval = setInterval(() => {
      fetchNotifications()
    }, 30000)

    return () => {
      window.removeEventListener('mousemove', resetTimer)
      window.removeEventListener('keydown', resetTimer)
      window.removeEventListener('click', resetTimer)
      window.removeEventListener('scroll', resetTimer)
      window.removeEventListener('touchstart', resetTimer)
      clearInterval(timeoutInterval)
      clearInterval(pollInterval)
    }
  }, [currentUser])

  // Refresh trigger handler
  const triggerRefresh = () => {
    setRefreshTrigger(prev => prev + 1)
  }

  // Ctrl+K Arama Kısayolu Dinleyici
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (currentUser && (e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setSearchModalOpen(prev => !prev)
      }
      // Escape ile modali kapat
      if (e.key === 'Escape') {
        setPasswordModalOpen(false)
        setProfileDropdownOpen(false)
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [currentUser])

  // Sayfa başlığını dinamik olarak güncelle
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (!currentUser) {
        document.title = 'HD Studio Yönetim Bilgi Sistemi'
      } else {
        const panelName = tabTitles[activeTab] || 'Yönetim Paneli'
        document.title = `${panelName} - HD Studio Yönetim Bilgi Sistemi`
      }
    }
  }, [currentUser, activeTab])

  const handleTabChange = useCallback((tabId) => {
    setActiveTab(tabId)
    setMobileMenuOpen(false)
  }, [])

  const activeComponent = useMemo(() => {
    if (!currentUser) return null
    const authErrorCallback = () => handleLogout('session_expired')
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard triggerRefresh={refreshTrigger} currentUser={currentUser} setActiveTab={handleTabChange} onAuthError={authErrorCallback} addToast={addToast} />
      case 'customers':
        return <Customers onAction={triggerRefresh} currentUser={currentUser} addToast={addToast} showConfirm={showConfirm} />
      case 'caris':
        return <Caris onAction={triggerRefresh} currentUser={currentUser} addToast={addToast} showConfirm={showConfirm} />
      case 'projects':
        return <Projects onAction={triggerRefresh} currentUser={currentUser} addToast={addToast} showConfirm={showConfirm} />
      case 'finance':
        return <Finance onAction={triggerRefresh} currentUser={currentUser} addToast={addToast} showConfirm={showConfirm} />
      case 'tasks':
        return <Tasks currentUser={currentUser} addToast={addToast} showConfirm={showConfirm} />
      case 'worklogs':
        return <WorkLogs currentUser={currentUser} addToast={addToast} showConfirm={showConfirm} />
      case 'calendar':
        return <CalendarPanel currentUser={currentUser} addToast={addToast} showConfirm={showConfirm} />
      case 'employees':
        return <Employees currentUser={currentUser} addToast={addToast} showConfirm={showConfirm} />
      case 'users':
        return <Users currentUser={currentUser} addToast={addToast} showConfirm={showConfirm} />
      case 'systemLogs':
        return <Logs currentUser={currentUser} addToast={addToast} showConfirm={showConfirm} />
      case 'monthlyCustomers':
        return <MonthlyCustomers currentUser={currentUser} addToast={addToast} showConfirm={showConfirm} />
      default:
        return <Dashboard triggerRefresh={refreshTrigger} currentUser={currentUser} setActiveTab={handleTabChange} onAuthError={authErrorCallback} addToast={addToast} />
    }
  }, [activeTab, refreshTrigger, currentUser, handleTabChange, addToast, showConfirm, handleLogout])

  const tabTitles = {
    dashboard: 'Dashboard',
    customers: 'Müşteriler',
    caris: 'Cari Hesap Yönetimi',
    projects: 'Çalışmalar',
    finance: 'Finans',
    tasks: 'Görevler',
    worklogs: 'İş Kayıt Defteri',
    calendar: 'Takvim',
    employees: 'Çalışan Yönetimi',
    users: 'Kullanıcı Yönetimi',
    systemLogs: 'Sistem Günlükleri',
    monthlyCustomers: 'Aylık Müşteriler'
  }

  const unreadCount = notifications.filter(n => !n.read).length

  // Giriş Yapılmamışsa Login Overlay Göster
  if (!currentUser) {
    return (
      <div className="flex min-h-screen bg-[#03000a] items-center justify-center relative overflow-hidden p-4">
        {/* Neon Işıklar */}
        <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] rounded-full bg-violet-600/15 blur-[120px] pointer-events-none z-0 glow-orb animate-orb-slow-1"></div>
        <div className="absolute bottom-[-10%] right-[10%] w-[600px] h-[600px] rounded-full bg-fuchsia-600/10 blur-[150px] pointer-events-none z-0 glow-orb animate-orb-slow-2"></div>

        {/* Uçuşan Beyaz Noktalar (Premium Star Particles) */}
        {mounted && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            <div className="w-1.5 h-1.5 bg-white/20 rounded-full absolute animate-float-particle-1" style={{ left: '10%', animationDuration: '18s', animationDelay: '0s' }}></div>
            <div className="w-1.5 h-1.5 bg-white/35 rounded-full absolute animate-float-particle-2" style={{ left: '25%', animationDuration: '22s', animationDelay: '2s' }}></div>
            <div className="w-2.5 h-2.5 bg-white/10 rounded-full absolute animate-float-particle-3" style={{ left: '40%', animationDuration: '26s', animationDelay: '1s' }}></div>
            <div className="w-1.5 h-1.5 bg-white/25 rounded-full absolute animate-float-particle-1" style={{ left: '55%', animationDuration: '20s', animationDelay: '4s' }}></div>
            <div className="w-1.5 h-1.5 bg-white/15 rounded-full absolute animate-float-particle-2" style={{ left: '70%', animationDuration: '24s', animationDelay: '3s' }}></div>
            <div className="w-2.5 h-2.5 bg-white/10 rounded-full absolute animate-float-particle-3" style={{ left: '85%', animationDuration: '28s', animationDelay: '5s' }}></div>
            <div className="w-1.5 h-1.5 bg-white/20 rounded-full absolute animate-float-particle-1" style={{ left: '95%', animationDuration: '19s', animationDelay: '1.5s' }}></div>
            <div className="w-1.5 h-1.5 bg-white/15 rounded-full absolute animate-float-particle-2" style={{ left: '33%', animationDuration: '25s', animationDelay: '6s' }}></div>
          </div>
        )}

        <div className="w-full max-w-md p-8 rounded-2xl glass-card relative z-10 border border-violet-500/15 text-center space-y-6 animate-fade-in shadow-2xl shadow-violet-600/5">
          <div className="flex flex-col items-center gap-3">
            <div className="w-64 h-16 bg-transparent flex items-center justify-center mb-1">
              <img src="/logo-login.png" alt="YOBIS Logo" className="w-full h-full object-contain filter drop-shadow-[0_0_12px_rgba(139,92,246,0.4)]" />
            </div>
            <div>
              <h1 className="font-extrabold text-2xl tracking-wider bg-gradient-to-r from-white to-violet-400 bg-clip-text text-transparent glow-text">
                YOBIS
              </h1>
              <p className="text-[10px] text-violet-400 font-semibold tracking-widest uppercase mt-0.5">
                Yönetim Bilgi Sistemi Girişi
              </p>
            </div>
          </div>


          <form onSubmit={handleLoginSubmit} action="" method="post" className="space-y-4 text-left">
            {loginError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-xs font-semibold">
                {loginError}
              </div>
            )}

            <div>
              <label className="text-xs text-gray-400 block mb-1.5 font-medium">Kullanıcı Adı</label>
              <input
                type="text"
                required
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                placeholder="Kullanıcı adınız..."
                className="w-full text-sm px-3.5 py-2.5 rounded-xl bg-violet-950/20 border border-violet-500/10 text-white focus:outline-none focus:border-violet-500 transition"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1.5 font-medium">Şifre</label>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Şifreniz..."
                className="w-full text-sm px-3.5 py-2.5 rounded-xl bg-violet-950/20 border border-violet-500/10 text-white focus:outline-none focus:border-violet-500 transition"
              />
            </div>

            <button
              type="submit"
              disabled={loggingIn}
              onClick={handleLoginSubmit}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition cursor-pointer shadow-lg shadow-violet-600/20 disabled:opacity-50"
            >
              {loggingIn ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Lock className="w-4 h-4" />
              )}
              <span>Oturum Aç</span>
            </button>
          </form>
          
          <div className="space-y-1">
            <div className="text-[11px] font-bold text-violet-400 tracking-wider">HD Studio Yönetim Bilgi Sistemi v2.4</div>
            <div className="text-[10px] text-gray-500">Varsayılan oturum süresi 30 dakikadır.</div>
          </div>
        </div>

        {/* Toast Container (login ekranında da göster) */}
        <ToastContainer toasts={toasts} removeToast={removeToast} />
      </div>
    )
  }

  // Giriş Yapılmışsa Ana Arayüzü Göster
  return (
    <div className="flex min-h-screen bg-[#03000a] text-gray-100 relative overflow-hidden">

      {/* 1. MASAÜSTÜ SIDEBAR (md ve üzeri) */}
      <div className="hidden md:flex relative z-10">
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={handleTabChange} 
          onUndoSuccess={triggerRefresh} 
          currentUser={currentUser}
          addToast={addToast}
        />
      </div>

      {/* 2. MOBİL SIDEBAR DRAWER (Tıklayınca açılır) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          ></div>
          
          <div className="relative flex flex-col w-64 max-w-xs bg-[#05020c] animate-slide-in-left border-r border-violet-500/10">
            <div className="absolute top-4 right-4 z-50">
              <button 
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-xl bg-violet-950/40 border border-violet-500/10 text-gray-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <Sidebar 
              activeTab={activeTab} 
              setActiveTab={handleTabChange} 
              onUndoSuccess={triggerRefresh} 
              currentUser={currentUser}
              addToast={addToast}
            />
          </div>
        </div>
      )}

      {/* Dinamik Sağ İçerik Alanı */}
      <div className="flex-1 flex flex-col relative z-10 max-h-screen overflow-hidden">
        
        {/* ÜST PANEL BAR */}
        <header className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-violet-500/10 glass relative z-30">
          <div className="flex items-center gap-2 sm:gap-3">
            <button 
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2.5 rounded-xl bg-violet-950/20 border border-violet-500/10 text-violet-400 hover:text-white transition"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-transparent flex items-center justify-center">
                <img src="/logo.png" alt="HD STUDIO Logo" className="w-7 h-7 sm:w-8 sm:h-8 object-contain filter drop-shadow-[0_0_8px_rgba(139,92,246,0.4)]" />
              </div>
              <div>
                <span className="font-black text-[10px] sm:text-xs tracking-wider text-white block">HD STUDIO</span>
                <span className="text-[8px] sm:text-[9px] text-violet-400 font-bold block leading-none">{tabTitles[activeTab]}</span>
              </div>
            </div>
          </div>
          
          {/* Arama, Bildirim Çanı ve Profil */}
          <div className="flex items-center gap-2 sm:gap-3 relative">
            {/* Hızlı Arama Butonu */}
            <button
              onClick={() => setSearchModalOpen(true)}
              className="p-2 sm:p-2.5 rounded-xl bg-violet-950/20 border border-violet-500/10 text-violet-400 hover:text-white transition flex items-center gap-1.5 cursor-pointer text-xs"
              title="Global Arama (Ctrl+K)"
            >
              <Search className="w-4 h-4" />
              <span className="hidden sm:inline text-[10px] font-bold opacity-80">Ara</span>
              <kbd className="hidden md:inline bg-violet-950/40 px-1 py-0.5 rounded border border-violet-500/10 text-[8px] font-mono leading-none">Ctrl+K</kbd>
            </button>

            {/* Bildirim Çanı */}
            <div className="relative" ref={notificationsDropdownRef}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className={`p-2 sm:p-2.5 rounded-xl bg-violet-950/20 border border-violet-500/10 text-violet-400 hover:text-white transition relative cursor-pointer ${
                  shouldBlink ? 'animate-bell-glow' : ''
                }`}
                title="Bildirimler"
              >
                <Bell className="w-4 sm:w-5 h-4 sm:h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-[#03000a] animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-3 w-80 max-h-96 rounded-2xl glass-card border border-violet-500/15 shadow-2xl p-4 overflow-y-auto z-50 animate-slide-in-top space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b border-violet-500/10">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Bildirimler</span>
                    <div className="flex gap-2 items-center">
                      {unreadCount > 0 && (
                        <button
                          onClick={handleMarkAllNotificationsRead}
                          className="text-[10px] text-violet-400 hover:text-white font-bold transition cursor-pointer"
                        >
                          Tümünü Okundu Yap
                        </button>
                      )}
                      {notifications.some(n => n.read) && (
                        <button
                          onClick={handleClearReadNotifications}
                          className={`text-[10px] text-rose-400 hover:text-rose-300 font-bold transition cursor-pointer ${unreadCount > 0 ? 'border-l border-violet-500/10 pl-2' : ''}`}
                        >
                          Okunanları Sil
                        </button>
                      )}
                    </div>
                  </div>

                  {pushSupported && !isPushSubscribed && (
                    <button
                      onClick={subscribeToPushNotifications}
                      disabled={subscribingPush}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 disabled:opacity-50 text-white rounded-xl text-[10px] font-bold transition shadow-lg shadow-violet-600/10 cursor-pointer mb-1"
                    >
                      <Bell className="w-3 h-3 animate-bounce" />
                      <span>{subscribingPush ? 'Etkinleştiriliyor...' : 'Cihaz Bildirimlerini Etkinleştir (iOS/Safari)'}</span>
                    </button>
                  )}

                  {notifications.length === 0 ? (
                    <div className="text-center py-6 text-xs text-gray-500 italic">
                      Bildirim bulunmuyor.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {notifications.map((notif) => (
                        <div
                          key={notif.id}
                          onClick={() => handleMarkNotificationRead(notif)}
                          className={`p-3 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                            notif.read
                              ? 'border-violet-500/5 bg-violet-950/5 text-gray-400'
                              : 'border-violet-500/15 bg-violet-950/25 text-white font-medium hover:border-violet-500/30'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span>{notif.message}</span>
                            {!notif.read && (
                              <span className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0 mt-1"></span>
                            )}
                          </div>
                          <span className="text-[9px] text-gray-500 block mt-1">
                            {new Date(notif.createdAt).toLocaleDateString('tr-TR', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Kullanıcı Profili — Dropdown Menüsü */}
            <div className="relative" ref={profileDropdownRef}>
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-violet-500/10 cursor-pointer group"
              >
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center text-white text-xs font-black shadow-lg shadow-violet-600/20">
                  {(currentUser.displayName || currentUser.username || '?').charAt(0).toUpperCase()}
                </div>
                <div className="hidden sm:block text-right">
                  <span className="text-xs font-bold text-white block">
                    {currentUser.displayName || currentUser.username}
                  </span>
                  <span className="text-[9px] text-violet-400 font-medium uppercase tracking-wider block leading-none mt-0.5">
                    {currentUser.role === 'admin' ? 'Yönetici' : 'Personel'}
                  </span>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform duration-200 ${profileDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Profile Dropdown */}
              {profileDropdownOpen && (
                <div className="absolute right-0 mt-3 w-56 rounded-xl glass-card border border-violet-500/15 shadow-2xl overflow-hidden z-50 animate-slide-in-top">
                  {/* Kullanıcı Bilgi Header */}
                  <div className="px-4 py-3 border-b border-violet-500/10">
                    <p className="text-sm font-bold text-white truncate">{currentUser.displayName || currentUser.username}</p>
                    <p className="text-[10px] text-violet-400 font-medium mt-0.5">@{currentUser.username}</p>
                  </div>

                  <div className="py-1">
                    {/* Şifre Değiştir */}
                    <button
                      onClick={() => { setPasswordModalOpen(true); setProfileDropdownOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-300 hover:text-white hover:bg-violet-950/30 transition cursor-pointer"
                    >
                      <KeyRound className="w-4 h-4 text-violet-400" />
                      <span className="font-medium">Şifre Değiştir</span>
                    </button>

                    {/* Çıkış Yap */}
                    <button
                      onClick={() => handleLogout('user_request')}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-rose-400 hover:text-rose-300 hover:bg-rose-950/20 transition cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span className="font-medium">Çıkış Yap</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Dinamik Sayfa Gövdesi */}
        <main className="flex-1 p-4 sm:p-5 md:p-12 overflow-y-auto max-h-[calc(100vh-60px)] sm:max-h-[calc(100vh-68px)]">
          <div className="max-w-6xl mx-auto">
            {activeComponent}
          </div>
        </main>
      </div>

      {/* Şifre Değiştirme Modal'ı */}
      {passwordModalOpen && (
        <div className="fixed inset-0 z-[9990] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setPasswordModalOpen(false)}></div>
          <div className="relative w-full max-w-md rounded-2xl glass-card border border-violet-500/15 p-6 shadow-2xl animate-slide-in-top z-10">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center">
                  <KeyRound className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">Şifre Değiştir</h3>
                  <p className="text-[11px] text-gray-400">Güvenliğiniz için şifrenizi güncelleyin</p>
                </div>
              </div>
              <button onClick={() => setPasswordModalOpen(false)} className="p-2 rounded-xl border border-violet-500/10 hover:border-violet-500/30 text-gray-400 hover:text-white transition cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              {/* Mevcut Şifre */}
              <div>
                <label className="text-xs text-gray-400 block mb-1.5 font-medium">Mevcut Şifre</label>
                <div className="relative">
                  <input
                    type={showCurrentPw ? 'text' : 'password'}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Mevcut şifreniz..."
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl bg-violet-950/20 border border-violet-500/10 text-white focus:outline-none focus:border-violet-500 transition pr-10"
                  />
                  <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition cursor-pointer">
                    {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Yeni Şifre */}
              <div>
                <label className="text-xs text-gray-400 block mb-1.5 font-medium">Yeni Şifre</label>
                <div className="relative">
                  <input
                    type={showNewPw ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Yeni şifreniz (min 4 karakter)..."
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl bg-violet-950/20 border border-violet-500/10 text-white focus:outline-none focus:border-violet-500 transition pr-10"
                    minLength={4}
                  />
                  <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition cursor-pointer">
                    {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Yeni Şifre Tekrar */}
              <div>
                <label className="text-xs text-gray-400 block mb-1.5 font-medium">Yeni Şifre (Tekrar)</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Yeni şifrenizi tekrarlayın..."
                  className={`w-full text-sm px-3.5 py-2.5 rounded-xl bg-violet-950/20 border text-white focus:outline-none transition ${
                    confirmPassword && confirmPassword !== newPassword
                      ? 'border-rose-500/40 focus:border-rose-500'
                      : 'border-violet-500/10 focus:border-violet-500'
                  }`}
                  minLength={4}
                />
                {confirmPassword && confirmPassword !== newPassword && (
                  <p className="text-[11px] text-rose-400 mt-1 font-medium">Şifreler eşleşmiyor!</p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPasswordModalOpen(false)}
                  className="flex-1 px-4 py-2.5 border border-violet-500/20 hover:border-violet-500/40 text-gray-400 hover:text-white text-sm font-semibold rounded-xl transition cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={changingPassword || (confirmPassword && confirmPassword !== newPassword)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition cursor-pointer disabled:opacity-50 shadow-lg shadow-violet-600/20"
                >
                  {changingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                  <span>Şifreyi Güncelle</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Global Arama Modali */}
      <SearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        onNavigate={handleTabChange}
      />

      {/* Global Toast Bildirimleri */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Custom Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}></div>
          <div className="relative w-full max-w-sm rounded-2xl glass-card border border-violet-500/15 p-6 shadow-2xl animate-slide-in-top z-10 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-rose-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">{confirmModal.title}</h3>
              <p className="text-sm text-gray-400 mt-1.5 leading-relaxed">{confirmModal.message}</p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 px-4 py-2.5 bg-violet-950/20 border border-violet-500/10 hover:border-violet-500/20 text-gray-300 hover:text-white text-xs font-bold uppercase tracking-wider rounded-xl transition cursor-pointer"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition cursor-pointer shadow-lg shadow-rose-600/20"
              >
                Tamam
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
