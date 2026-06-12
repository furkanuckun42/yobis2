'use client'

import { useState, useEffect } from 'react'
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  Trash2, 
  PlusCircle, 
  MinusCircle,
  Save,
  Lock,
  Building2,
  Banknote,
  BookOpen,
  X,
  FileText,
  BarChart3,
  Download,
  Printer
} from 'lucide-react'

// Yerel saat dilimine göre YYYY-MM-DD formatında tarih üretir (timezone-safe)
const getLocalDateString = (date = new Date()) => {
  const offset = date.getTimezoneOffset()
  const localDate = new Date(date.getTime() - (offset * 60 * 1000))
  return localDate.toISOString().split('T')[0]
}
import Charts from '@/app/components/Charts'

export default function Finance({ onAction, currentUser, addToast, showConfirm }) {
  const [records, setRecords] = useState([])
  const [customers, setCustomers] = useState([])
  const [caris, setCaris] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState('ALL')
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)
  const [isChartOpen, setIsChartOpen] = useState(false)
  const isAdmin = currentUser?.role === 'admin'

  // Form State
  const [form, setForm] = useState({
    type: 'GELIR',
    category: 'KASA', // 'KASA' veya 'CARI'
    amount: '',
    description: '',
    date: getLocalDateString(),
    customerId: '',
    cariId: ''
  })

  const fetchFinanceRecords = async () => {
    try {
      const res = await fetch('/api/finance')
      if (res.ok) {
        const json = await res.json()
        setRecords(json)
      }
    } catch (err) {
      console.error('Finans verileri yüklenemedi:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/customers')
      if (res.ok) {
        const json = await res.json()
        setCustomers(json)
      }
    } catch (err) {
      console.error('Müşteri verileri yüklenemedi:', err)
    }
  }

  const fetchCaris = async () => {
    try {
      const res = await fetch('/api/caris')
      if (res.ok) {
        const json = await res.json()
        setCaris(json)
      }
    } catch (err) {
      console.error('Cari verileri yüklenemedi:', err)
    }
  }

  useEffect(() => {
    fetchFinanceRecords()
    fetchCustomers()
    fetchCaris()
  }, [])

  const resetForm = () => {
    setForm({
      type: 'GELIR',
      category: 'KASA',
      amount: '',
      description: '',
      date: getLocalDateString(),
      customerId: '',
      cariId: ''
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.amount || parseFloat(form.amount) <= 0) {
      addToast('Lütfen geçerli bir tutar girin!', 'warning')
      return
    }
    if (form.type === 'KAR_ALMA' && !isAdmin) {
      addToast('Kâr alma işlemini sadece yöneticiler gerçekleştirebilir!', 'error')
      return
    }
    if (form.category === 'CARI' && !form.cariId) {
      addToast('Cari işlem için lütfen bir firma seçin!', 'warning')
      return
    }
    
    const todayStr = getLocalDateString()
    if (form.date && form.date > todayStr) {
      addToast('Gelecekteki bir tarihe işlem yapılamaz!', 'warning')
      return
    }

    try {
      const res = await fetch('/api/finance', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-requester-role': currentUser?.role || ''
        },
        body: JSON.stringify(form)
      })

      if (res.ok) {
        fetchFinanceRecords()
        fetchCustomers()
        fetchCaris()
        resetForm()
        if (onAction) onAction()
      } else {
        const err = await res.json()
        addToast(err.error || 'Finansal kayıt eklenemedi', 'error')
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleDelete = (id) => {
    showConfirm('Bu finansal kaydı silmek istediğinizden emin misiniz?', async () => {
      try {
        const res = await fetch(`/api/finance?id=${id}`, { 
          method: 'DELETE',
          headers: {
            'x-requester-role': currentUser?.role || ''
          }
        })
        if (res.ok) {
          fetchFinanceRecords()
          fetchCustomers()
          fetchCaris()
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

  // Filtreleme
  const todayStr = getLocalDateString()

  // Benzersiz ayları al
  const uniqueMonths = Array.from(
    new Set(
      records.map(r => {
        const d = new Date(r.date)
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      })
    )
  ).sort().reverse() // Yeni aylar en üstte

  const formatMonthYear = (monthStr) => {
    if (!monthStr || monthStr === 'ALL') return 'Tüm Zamanlar'
    const [year, month] = monthStr.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1, 1)
    return date.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })
  }

  // Aysonu Raporu Hesaplama
  const getMonthlyReport = () => {
    const report = {}
    records.forEach(r => {
      if (r.category !== 'KASA') return
      const d = new Date(r.date)
      const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      
      if (!report[mKey]) {
        report[mKey] = { income: 0, expense: 0 }
      }
      
      if (r.type === 'GELIR') {
        report[mKey].income += r.amount
      } else {
        report[mKey].expense += r.amount
      }
    })
    
    return Object.entries(report).map(([month, data]) => ({
      month,
      income: data.income,
      expense: data.expense,
      netProfit: data.income - data.expense
    })).sort((a, b) => b.month.localeCompare(a.month))
  }

  // Son 6 Ayın Finansal Trend Verisi Hesaplama (Grafik için)
  const getChartData = () => {
    const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]
    const monthsList = []
    
    // Son 6 ayı kronolojik (eskiden yeniye) oluştur
    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      monthsList.push({
        year: d.getFullYear(),
        monthNum: d.getMonth(),
        month: monthNames[d.getMonth()],
        income: 0,
        expense: 0,
        profit: 0
      })
    }

    records.forEach(record => {
      const rDate = new Date(record.date)
      const rYear = rDate.getFullYear()
      const rMonth = rDate.getMonth()

      const monthObj = monthsList.find(m => m.year === rYear && m.monthNum === rMonth)
      if (monthObj) {
        if (record.category === 'KASA') {
          if (record.type === 'GELIR') {
            monthObj.income += record.amount
          } else if (record.type === 'GIDER') {
            monthObj.expense += record.amount
          }
        }
      }
    })

    monthsList.forEach(m => {
      m.profit = m.income - m.expense
    })

    return monthsList
  }

  const exportToCSV = () => {
    const dataToExport = filteredRecords
    const headers = ['Tarih', 'Açıklama', 'Kategori', 'Tür', 'Tutar']
    const rows = dataToExport.map(r => {
      const formattedDate = new Date(r.date).toLocaleDateString('tr-TR')
      const category = r.category === 'CARI' ? 'CARİ' : 'KASA'
      const type = r.type === 'GELIR' ? 'GELİR' : 'GİDER'
      const amount = r.amount.toString()
      const description = (r.description || '').replace(/;/g, ' ')
      return [formattedDate, description, category, type, amount]
    })
    
    const csvContent = "\uFEFF" + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `finans_gecmisi_${selectedMonth === 'ALL' ? 'tum_zamanlar' : selectedMonth}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Admin: tüm kayıtlar (veya seçilen ay) | Personel: sadece bugünün KASA ve CARİ kayıtları
  const baseRecords = isAdmin
    ? records
    : records.filter(r => {
        const recDate = getLocalDateString(new Date(r.date))
        return recDate === todayStr
      })

  const filteredRecords = selectedMonth === 'ALL'
    ? baseRecords
    : baseRecords.filter(r => {
        const d = new Date(r.date)
        const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        return mStr === selectedMonth
      })

  // Kasa toplamları (sadece KASA kategorisi)
  const kasaRecords = records.filter(r => r.category === 'KASA')
  const totalIncome = kasaRecords.filter(r => r.type === 'GELIR').reduce((sum, r) => sum + r.amount, 0)
  const totalExpense = kasaRecords.filter(r => r.type === 'GIDER').reduce((sum, r) => sum + r.amount, 0)
  const totalKarAlma = kasaRecords.filter(r => r.type === 'KAR_ALMA').reduce((sum, r) => sum + r.amount, 0)
  const netBalance = totalIncome - totalExpense - totalKarAlma

  // Bugünün kasa toplamları (personel)
  const todayKasa = kasaRecords.filter(r => getLocalDateString(new Date(r.date)) === todayStr)
  const todayIncome = todayKasa.filter(r => r.type === 'GELIR').reduce((sum, r) => sum + r.amount, 0)
  const todayExpense = todayKasa.filter(r => r.type === 'GIDER').reduce((sum, r) => sum + r.amount, 0)

  // Cari toplamlar
  const cariRecords = records.filter(r => r.category === 'CARI')
  const totalCariGider = cariRecords.filter(r => r.type === 'GIDER').reduce((sum, r) => sum + r.amount, 0)
  const totalCariGelir = cariRecords.filter(r => r.type === 'GELIR').reduce((sum, r) => sum + r.amount, 0)

  // Cari Borç Toplamı: cari yönetimindeki tüm aktif hesapların pozitif currentBalance toplamı
  const activeCariDebt = caris.reduce((sum, c) => sum + (c.currentBalance > 0 ? Number(c.currentBalance) : 0), 0)

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Title */}
      <div>
        <h2 className="text-3xl font-extrabold tracking-tight glow-text text-white">
          {isAdmin ? 'Finans & Kasa Takibi' : 'Günlük Giriş / Çıkış'}
        </h2>
        <p className="text-gray-400 mt-1">
          {isAdmin
            ? 'Kasa ve cari hesap hareketlerini yönetin.'
            : 'Bugüne ait gelir ve gider kayıtlarınızı girebilirsiniz.'}
        </p>
      </div>

      {/* Stats row */}
      {isAdmin ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="p-5 rounded-2xl glass border border-emerald-500/10 flex justify-between items-center">
            <div>
              <span className="text-[10px] text-gray-400 block uppercase font-bold tracking-wider">Kasa Gelir</span>
              <span className="text-xl font-bold text-emerald-400 mt-1 block">
                {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(totalIncome)}
              </span>
            </div>
            <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>

          <div className="p-5 rounded-2xl glass border border-rose-500/10 flex justify-between items-center">
            <div>
              <span className="text-[10px] text-gray-400 block uppercase font-bold tracking-wider">Kasa Gider</span>
              <span className="text-xl font-bold text-rose-400 mt-1 block">
                {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(totalExpense)}
              </span>
            </div>
            <div className="p-2.5 bg-rose-500/10 rounded-xl text-rose-400">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>

          <div className="p-5 rounded-2xl glass border border-violet-500/10 flex justify-between items-center">
            <div>
              <span className="text-[10px] text-gray-400 block uppercase font-bold tracking-wider">Kasa Net Bakiye</span>
              <span className={`text-xl font-black mt-1 block ${netBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(netBalance)}
              </span>
            </div>
            <div className="p-2.5 bg-violet-500/10 rounded-xl text-violet-400">
              <Wallet className="w-5 h-5" />
            </div>
          </div>

          <div className="p-5 rounded-2xl glass border border-amber-500/10 flex justify-between items-center">
            <div>
              <span className="text-[10px] text-gray-400 block uppercase font-bold tracking-wider">Cari Borç Toplamı</span>
              <span className="text-xl font-bold text-amber-400 mt-1 block">
                {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(activeCariDebt)}
              </span>
            </div>
            <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-400">
              <BookOpen className="w-5 h-5" />
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-5 rounded-2xl glass border border-emerald-500/10 flex justify-between items-center">
            <div>
              <span className="text-[10px] text-gray-400 block uppercase font-bold tracking-wider">Bugünkü Gelir</span>
              <span className="text-xl font-bold text-emerald-400 mt-1 block">
                {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(todayIncome)}
              </span>
            </div>
            <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>

          <div className="p-5 rounded-2xl glass border border-rose-500/10 flex justify-between items-center">
            <div>
              <span className="text-[10px] text-gray-400 block uppercase font-bold tracking-wider">Bugünkü Gider</span>
              <span className="text-xl font-bold text-rose-400 mt-1 block">
                {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(todayExpense)}
              </span>
            </div>
            <div className="p-2.5 bg-rose-500/10 rounded-xl text-rose-400">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Form */}
        <div className="p-6 rounded-2xl glass-card h-fit space-y-4">
          <h3 className="font-bold text-lg text-white flex items-center gap-2 pb-2 border-b border-violet-500/10">
            <Wallet className="w-5 h-5 text-violet-400" />
            <span>Gelir / Gider Girişi</span>
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            {/* İşlem Türü */}
            <div>
              <label className="text-xs text-gray-400 block mb-1">İşlem Türü</label>
              <div className={`grid ${isAdmin ? 'grid-cols-3' : 'grid-cols-2'} gap-2`}>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, type: 'GELIR' })}
                  className={`py-2 px-4 rounded-xl text-xs sm:text-sm font-semibold border flex items-center justify-center gap-1.5 transition ${
                    form.type === 'GELIR'
                      ? 'bg-emerald-600 border-emerald-500 text-white'
                      : 'bg-violet-950/10 border-violet-500/10 text-gray-400 hover:text-white'
                  }`}
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Gelir</span>
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, type: 'GIDER' })}
                  className={`py-2 px-4 rounded-xl text-xs sm:text-sm font-semibold border flex items-center justify-center gap-1.5 transition ${
                    form.type === 'GIDER'
                      ? 'bg-rose-600 border-rose-500 text-white'
                      : 'bg-violet-950/10 border-violet-500/10 text-gray-400 hover:text-white'
                  }`}
                >
                  <MinusCircle className="w-4 h-4" />
                  <span>Gider</span>
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, type: 'KAR_ALMA', category: 'KASA', customerId: '', cariId: '' })}
                    className={`py-2 px-4 rounded-xl text-xs sm:text-sm font-semibold border flex items-center justify-center gap-1.5 transition ${
                      form.type === 'KAR_ALMA'
                        ? 'bg-amber-600 border-amber-500 text-white shadow-md'
                        : 'bg-violet-950/10 border-violet-500/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    <Banknote className="w-4 h-4" />
                    <span>Kâr Alma</span>
                  </button>
                )}
              </div>
            </div>

            {/* Kategori: Kasa / Cari — GELIR veya GIDER fark etmeksizin göster (KAR_ALMA değilse) */}
            {form.type !== 'KAR_ALMA' && (
              <div>
                <label className="text-xs text-gray-400 block mb-1">
                  {form.type === 'GELIR' ? 'Gelir Kaynağı' : 'Gider Kaynağı'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, category: 'KASA', customerId: '', cariId: '' })}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition ${
                      form.category === 'KASA'
                        ? 'bg-violet-600 border-violet-500 text-white'
                        : 'bg-violet-950/10 border-violet-500/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    <Banknote className="w-4 h-4" />
                    <span>{form.type === 'GELIR' ? 'Kasa Girişi' : 'Kasa Çıkışı'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, category: 'CARI', customerId: '', cariId: '' })}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition ${
                      form.category === 'CARI'
                        ? 'bg-amber-600 border-amber-500 text-white'
                        : 'bg-violet-950/10 border-violet-500/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    <Building2 className="w-4 h-4" />
                    <span>{form.type === 'GELIR' ? 'Cari (Borçtan Düşer)' : 'Cari'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Firma Seçimi — CARİ seçiliyse göster */}
            {form.category === 'CARI' && (
              <div>
                <label className="text-xs text-gray-400 block mb-1">Firma / Cari</label>
                <select
                  value={form.cariId}
                  onChange={(e) => setForm({ ...form, cariId: e.target.value })}
                  required
                  className="w-full text-sm px-4 py-2.5 rounded-xl bg-violet-950/20 border border-amber-500/20 text-white focus:outline-none focus:border-amber-500/40 focus:bg-violet-950/30 transition cursor-pointer"
                >
                  <option value="" className="bg-[#05020c] text-gray-400">Firma seçin...</option>
                  {caris.map(c => (
                    <option key={c.id} value={c.id} className="bg-[#05020c] text-white">
                      {c.name}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-amber-400/70 mt-1.5 flex items-center gap-1">
                  <BookOpen className="w-3 h-3" />
                  {form.type === 'GELIR' 
                    ? 'Cari gelir kasaya girmez, firmaya olan borcumuzdan düşülür.' 
                    : 'Cari gider kasadan düşmez, firmaya borç olarak eklenir.'}
                </p>
              </div>
            )}

            {/* Cari Ödeme Seçimi — GIDER ve KASA modunda göster */}
            {form.type === 'GIDER' && form.category === 'KASA' && (
              <div>
                <label className="text-xs text-gray-400 block mb-1">Cari Ödeme Yap (Opsiyonel)</label>
                <select
                  value={form.cariId}
                  onChange={(e) => setForm({ ...form, cariId: e.target.value })}
                  className="w-full text-sm px-4 py-2.5 rounded-xl bg-violet-950/20 border border-violet-500/10 text-white focus:outline-none focus:border-violet-500/40 focus:bg-violet-950/30 transition cursor-pointer"
                >
                  <option value="" className="bg-[#05020c] text-gray-400">Firma seçin (Cari Ödeme ise)...</option>
                  {caris.map(c => (
                    <option key={c.id} value={c.id} className="bg-[#05020c] text-white">
                      {c.name}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-500 mt-1">
                  Firma seçilirse girilen tutar firmaya olan borcumuzdan düşülür.
                </p>
              </div>
            )}

            {/* Gelir Panelinin Altına Cari Ödeme Yap Açıklaması */}
            {form.type === 'GELIR' && form.category === 'KASA' && (
              <div className="p-3.5 rounded-xl bg-violet-950/20 border border-violet-500/10 text-xs text-gray-400 space-y-1">
                <span className="font-bold text-violet-400 block">💡 Cari Ödeme Yap:</span>
                <p className="leading-relaxed">
                  Cari firmaya ödeme yapmak (borçtan düşmek) istiyorsanız; yukarıdan işlem türünü <strong className="text-white">"Gider"</strong>, kaynağı <strong className="text-white">"Kasa Çıkışı"</strong> seçip açılan listeden ödeme yapacağınız firmayı seçebilirsiniz.
                </p>
              </div>
            )}

            {/* Tutar */}
            <div>
              <label className="text-xs text-gray-400 block mb-1">Tutar (₺)</label>
              <input
                type="number"
                required
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0.00"
                className="w-full text-sm px-4 py-2.5 rounded-xl bg-violet-950/20 border border-violet-500/10 text-white focus:outline-none focus:border-violet-500/40 focus:bg-violet-950/30 transition"
              />
            </div>

            {/* Açıklama */}
            <div>
              <label className="text-xs text-gray-400 block mb-1">Açıklama</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Örn: X Projesi Avansı, Set Yemek Gideri..."
                className="w-full text-sm px-4 py-2.5 rounded-xl bg-violet-950/20 border border-violet-500/10 text-white focus:outline-none focus:border-violet-500/40 focus:bg-violet-950/30 transition"
              />
            </div>

            {/* Tarih */}
            <div>
              <label className="text-xs text-gray-400 block mb-1">İşlem Tarihi</label>
              <input
                type="date"
                required
                max={todayStr}
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full text-sm px-4 py-2.5 rounded-xl bg-violet-950/20 border border-violet-500/10 text-white focus:outline-none focus:border-violet-500/40 focus:bg-violet-950/30 transition"
              />
            </div>

            <button
              type="submit"
              className={`w-full py-3 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition ${
                form.category === 'CARI' && isAdmin
                  ? 'bg-amber-600 hover:bg-amber-500'
                  : 'bg-violet-600 hover:bg-violet-500'
              }`}
            >
              <Save className="w-4 h-4" />
              <span>{form.category === 'CARI' ? 'Cari Kayıt Ekle' : 'Kayıt Ekle'}</span>
            </button>
          </form>
        </div>

        {/* Right Column: Transaction History */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="font-bold text-lg text-white flex items-center gap-2">
              <span>{isAdmin ? 'Tüm İşlem Geçmişi' : 'Bugünün İşlemleri'}</span>
              {!isAdmin && (
                <span className="ml-2 flex items-center gap-1 text-[10px] text-amber-400/80 border border-amber-500/20 bg-amber-500/5 px-2 py-0.5 rounded-full font-semibold">
                  <Lock className="w-3 h-3" /> Sadece bugün
                </span>
              )}
            </h3>

            {isAdmin && (
              <div className="flex flex-wrap items-center gap-2">
                {/* Grafik Butonu */}
                <button
                  type="button"
                  onClick={() => setIsChartOpen(!isChartOpen)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition cursor-pointer text-xs font-bold ${
                    isChartOpen 
                      ? 'bg-violet-600 text-white glow-purple shadow-md' 
                      : 'bg-violet-950/20 border border-violet-500/10 text-gray-400 hover:text-white'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>Grafik</span>
                </button>

                {/* Ay Filtresi */}
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="text-xs px-3 py-2 rounded-xl bg-violet-950/20 border border-violet-500/10 text-white focus:outline-none focus:border-violet-500 transition cursor-pointer"
                >
                  <option value="ALL">Tüm Zamanlar</option>
                  {uniqueMonths.map(m => (
                    <option key={m} value={m}>{formatMonthYear(m)}</option>
                  ))}
                </select>

                {/* Rapor Butonu */}
                <button
                  type="button"
                  onClick={() => setIsReportModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-xs font-bold text-white rounded-xl transition cursor-pointer shadow-lg shadow-violet-600/15"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Aysonu Raporu Al</span>
                </button>

                {/* Excel İndir Butonu */}
                <button
                  type="button"
                  onClick={exportToCSV}
                  className="flex items-center gap-1.5 px-3 py-2 bg-[#1b1406] hover:bg-amber-950/20 text-amber-400 border border-amber-500/20 text-xs font-bold rounded-xl transition cursor-pointer"
                  title="Excel / CSV Olarak İndir"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Excel</span>
                </button>

                {/* Yazdır Butonu */}
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-2 bg-violet-950/20 border border-violet-500/10 text-gray-300 hover:text-white text-xs font-bold rounded-xl transition cursor-pointer"
                  title="Listeyi Yazdır"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Yazdır</span>
                </button>
              </div>
            )}
          </div>

          {isAdmin && isChartOpen && (
            <div className="animate-slide-in-top">
              <Charts data={getChartData()} records={records} selectedMonth={selectedMonth} />
            </div>
          )}

          {loading ? (
            <div className="py-24 flex justify-center items-center rounded-2xl glass">
              <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="text-center py-24 text-gray-500 text-sm rounded-2xl glass">
              {isAdmin ? 'Finansal hareket bulunamadı. Gelir/Gider ekleyerek başlayın.' : 'Bugüne ait kayıt bulunamadı.'}
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto rounded-2xl border border-violet-500/10 glass max-h-[60vh] overflow-y-auto pr-1">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-violet-500/10 text-xs text-gray-500 uppercase tracking-wider bg-violet-950/10">
                      <th className="p-4">Tarih</th>
                      <th className="p-4">Açıklama</th>
                      {isAdmin && <th className="p-4">Kategori</th>}
                      <th className="p-4">Tür</th>
                      <th className="p-4 text-right">Tutar</th>
                      {isAdmin && <th className="p-4 text-center">Sil</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.map((r) => (
                      <tr key={r.id} className="border-b border-violet-500/5 hover:bg-violet-950/10 text-sm text-gray-300">
                        <td className="p-4 font-medium whitespace-nowrap">
                          {new Date(r.date).toLocaleDateString('tr-TR')}
                        </td>
                        <td className="p-4">
                          <div>
                            {r.description || <span className="text-gray-600 italic">Açıklama yok</span>}
                          </div>
                          {r.customer && (
                            <div className="text-[10px] text-violet-400 mt-0.5 flex items-center gap-1">
                              <Building2 className="w-3 h-3 text-violet-400" />
                              <span>Müşteri: {r.customer.name}</span>
                            </div>
                          )}
                          {r.cari && (
                            <div className="text-[10px] text-amber-400 mt-0.5 flex items-center gap-1">
                              <Building2 className="w-3 h-3 text-amber-400" />
                              <span>Firma (Cari): {r.cari.name}</span>
                            </div>
                          )}
                        </td>
                        {isAdmin && (
                          <td className="p-4">
                            <span className={`px-2 py-0.5 text-[10px] rounded-full border font-bold ${
                              r.category === 'CARI'
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                : 'bg-violet-500/10 text-violet-400 border-violet-500/20'
                            }`}>
                              {r.category === 'CARI' ? 'CARİ' : 'KASA'}
                            </span>
                          </td>
                        )}
                        <td className="p-4">
                          <span className={`px-2 py-0.5 text-xs rounded-full border font-bold ${
                            r.type === 'GELIR'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : r.type === 'KAR_ALMA'
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          }`}>
                            {r.type === 'KAR_ALMA' ? 'KÂR ALMA' : r.type}
                          </span>
                        </td>
                        <td className={`p-4 text-right font-bold whitespace-nowrap ${
                          r.type === 'GELIR' ? 'text-emerald-400' : (r.type === 'KAR_ALMA' ? 'text-amber-400' : 'text-rose-400')
                        }`}>
                          {r.type === 'GELIR' ? '+' : '-'} {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(r.amount)}
                        </td>
                        {isAdmin && (
                          <td className="p-4 text-center">
                            <button
                              onClick={() => handleDelete(r.id)}
                              className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg transition cursor-pointer"
                              title="İşlemi Sil"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List View */}
              <div className="md:hidden space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                {filteredRecords.map((r) => (
                  <div key={r.id} className="p-4 rounded-xl border border-violet-500/10 glass flex flex-col gap-2.5 text-xs text-gray-300">
                    <div className="flex justify-between items-center text-[10px] text-gray-400">
                      <span className="font-semibold">{new Date(r.date).toLocaleDateString('tr-TR')}</span>
                      <div className="flex gap-1">
                        {isAdmin && (
                          <span className={`px-1.5 py-0.5 rounded border text-[8px] font-bold ${
                            r.category === 'CARI'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              : 'bg-violet-500/10 text-violet-400 border-violet-500/20'
                          }`}>
                            {r.category === 'CARI' ? 'CARİ' : 'KASA'}
                          </span>
                        )}
                        <span className={`px-1.5 py-0.5 rounded border text-[8px] font-bold ${
                          r.type === 'GELIR'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : r.type === 'KAR_ALMA'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}>
                          {r.type === 'KAR_ALMA' ? 'KÂR ALMA' : r.type}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="font-bold text-white whitespace-normal break-words">
                        {r.description || <span className="text-gray-600 italic">Açıklama yok</span>}
                      </div>
                      {r.customer && (
                        <div className="text-[10px] text-violet-400 flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          <span>Müşteri: {r.customer.name}</span>
                        </div>
                      )}
                      {r.cari && (
                        <div className="text-[10px] text-amber-400 flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          <span>Firma (Cari): {r.cari.name}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-violet-500/5 mt-0.5">
                      <span className={`text-sm font-extrabold ${
                        r.type === 'GELIR' ? 'text-emerald-400' : (r.type === 'KAR_ALMA' ? 'text-amber-400' : 'text-rose-400')
                      }`}>
                        {r.type === 'GELIR' ? '+' : '-'} {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(r.amount)}
                      </span>
                      {isAdmin && (
                        <button
                          onClick={() => handleDelete(r.id)}
                          className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg transition cursor-pointer"
                          title="İşlemi Sil"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Aysonu Raporu Modalı */}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="w-full max-w-2xl p-6 rounded-2xl glass-card border border-violet-500/15 text-left space-y-6 animate-slide-in-top max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-violet-500/10">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-violet-500/10 rounded-xl text-violet-400">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-white">Aysonu Raporu / Finansal Özet</h3>
                  <p className="text-xs text-gray-400">Aylık bazda gelir, gider ve net kar tablosu (Kasa)</p>
                </div>
              </div>
              <button
                onClick={() => setIsReportModalOpen(false)}
                className="p-2 rounded-xl bg-violet-950/40 border border-violet-500/10 text-gray-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              {getMonthlyReport().length === 0 ? (
                <div className="text-center py-12 text-gray-500 text-sm italic">
                  Hesaplanacak finansal hareket bulunmuyor.
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-violet-500/10 bg-violet-950/5">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-violet-500/10 text-xs text-gray-400 uppercase tracking-wider bg-violet-950/20">
                        <th className="p-4">Dönem</th>
                        <th className="p-4 text-right text-emerald-400">Kasa Gelir</th>
                        <th className="p-4 text-right text-rose-400">Kasa Gider</th>
                        <th className="p-4 text-right font-bold text-violet-300">Net Kâr (Kasa)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getMonthlyReport().map((rep) => (
                        <tr key={rep.month} className="border-b border-violet-500/5 hover:bg-violet-950/10 text-sm text-gray-300">
                          <td className="p-4 font-bold uppercase">
                            {formatMonthYear(rep.month)}
                          </td>
                          <td className="p-4 text-right text-emerald-400 font-medium">
                            {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(rep.income)}
                          </td>
                          <td className="p-4 text-right text-rose-400 font-medium">
                            {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(rep.expense)}
                          </td>
                          <td className={`p-4 text-right font-black whitespace-nowrap ${
                            rep.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}>
                            {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(rep.netProfit)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-violet-500/10 gap-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl border border-violet-500/10 bg-violet-950/20 text-xs font-bold text-gray-300 hover:text-white transition cursor-pointer"
              >
                Raporu Yazdır
              </button>
              <button
                type="button"
                onClick={() => setIsReportModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-xs font-bold text-white transition cursor-pointer"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
