'use client'

import { useState, useEffect } from 'react'
import { 
  Calendar as CalendarIcon, 
  PlusCircle, 
  Trash2, 
  Check, 
  Clock, 
  Save, 
  Lock, 
  X,
  DollarSign,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'

// Yerel saat dilimine göre YYYY-MM-DD formatında tarih üretir (timezone-safe)
const getLocalDateString = (date = new Date()) => {
  const offset = date.getTimezoneOffset()
  const localDate = new Date(date.getTime() - (offset * 60 * 1000))
  return localDate.toISOString().split('T')[0]
}

export default function WorkLogs({ currentUser, addToast, showConfirm }) {
  const [logs, setLogs] = useState([])
  const [employees, setEmployees] = useState([])
  const [myEmployee, setMyEmployee] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedLogs, setSelectedLogs] = useState([])
  const isAdmin = currentUser?.role === 'admin'

  // Form State
  const [form, setForm] = useState({
    employeeId: '',
    date: getLocalDateString(),
    type: 'TAM', // 'TAM' veya 'YARIM' veya 'UZAKTAN'
    amount: '',
    description: ''
  })

  // Selected Filter for Admin
  const [filterEmployeeId, setFilterEmployeeId] = useState('')

  // Ay Filtresi
  const now = new Date()
  const [filterMonth, setFilterMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  )
  const [showAllMonths, setShowAllMonths] = useState(false)

  const prevFilterMonth = () => {
    setFilterMonth(prev => {
      const [y, m] = prev.split('-').map(Number)
      const d = new Date(y, m - 2, 1)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    })
  }

  const nextFilterMonth = () => {
    setFilterMonth(prev => {
      const [y, m] = prev.split('-').map(Number)
      const d = new Date(y, m, 1)
      const nowDate = new Date()
      const maxStr = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, '0')}`
      const newStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (newStr > maxStr) return prev
      return newStr
    })
  }

  const filterMonthLabel = (() => {
    const [y, m] = filterMonth.split('-').map(Number)
    const names = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']
    return `${names[m - 1]} ${y}`
  })()

  const isCurrentFilterMonth = (() => {
    const nowDate = new Date()
    const currentStr = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, '0')}`
    return filterMonth === currentStr
  })()

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/worklogs', {
        headers: {
          'x-requester-id': currentUser?.id || '',
          'x-requester-role': currentUser?.role || ''
        }
      })
      if (res.ok) {
        const json = await res.json()
        setLogs(json)
        setSelectedLogs([])
      }
    } catch (err) {
      console.error(err)
    }
  }

  const fetchEmployees = async () => {
    try {
      const res = await fetch('/api/employees')
      if (res.ok) {
        const json = await res.json()
        setEmployees(json)
        // Giriş yapan kullanıcının eşleştiği çalışanı bul
        const found = json.find(emp => emp.userId === currentUser?.id)
        if (found) {
          setMyEmployee(found)
        }
      }
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await Promise.all([fetchLogs(), fetchEmployees()])
      setLoading(false)
    }
    init()
  }, [])

  useEffect(() => {
    setSelectedLogs([])
  }, [filterEmployeeId])

  const handleAddLog = async (e) => {
    e.preventDefault()
    
    const bodyData = {
      date: form.date,
      type: form.type
    }

    if (form.type === 'UZAKTAN') {
      if (!form.amount || !form.description) {
        addToast('Lütfen uzaktan çalışma için özel tutar ve açıklama girin!', 'warning')
        return
      }
      bodyData.amount = parseFloat(form.amount)
      bodyData.description = form.description
    }

    if (isAdmin) {
      if (!form.employeeId) {
        addToast('Lütfen çalışan seçin!', 'warning')
        return
      }
      bodyData.employeeId = form.employeeId
    }

    try {
      const res = await fetch('/api/worklogs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-requester-id': currentUser?.id || '',
          'x-requester-role': currentUser?.role || ''
        },
        body: JSON.stringify(bodyData)
      })

      if (res.ok) {
        fetchLogs()
        setForm({
          ...form,
          employeeId: isAdmin ? form.employeeId : '',
          date: getLocalDateString(),
          type: 'TAM',
          amount: '',
          description: ''
        })
        addToast('Çalışma günü başarıyla kaydedildi.', 'success')
      } else {
        const err = await res.json()
        addToast(err.error || 'Kayıt eklenemedi.', 'error')
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Admin yevmiye ödemesi yaptığında durumu günceller
  const handleMarkPaid = (logId) => {
    showConfirm('Bu çalışma gününü "Ödendi" olarak işaretlemek istediğinizden emin misiniz?', async () => {
      try {
        const res = await fetch('/api/worklogs', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-requester-id': currentUser?.id || '',
            'x-requester-role': currentUser?.role || ''
          },
          body: JSON.stringify({
            id: logId,
            status: 'ODENDI'
          })
        })

        if (res.ok) {
          fetchLogs()
        } else {
          const err = await res.json()
          addToast(err.error || 'Güncelleme başarısız.', 'error')
        }
      } catch (err) {
        console.error(err)
      }
    })
  }

  // Kaydı silme (personel sadece ödenmemiş olanları silebilir)
  const handleDeleteLog = (logId) => {
    showConfirm('Bu çalışma kaydını silmek istediğinizden emin misiniz?', async () => {
      try {
        const res = await fetch(`/api/worklogs?id=${logId}`, {
          method: 'DELETE',
          headers: {
            'x-requester-id': currentUser?.id || '',
            'x-requester-role': currentUser?.role || ''
          }
        })

        if (res.ok) {
          fetchLogs()
        } else {
          const err = await res.json()
          addToast(err.error || 'Silme başarısız.', 'error')
        }
      } catch (err) {
        console.error(err)
      }
    })
  }

  // Filtrelenmiş Kayıtlar (personel + ay filtresi)
  const filteredLogs = logs.filter(log => {
    // Çalışan filtresi (admin için)
    if (isAdmin && filterEmployeeId !== '') {
      if (log.employeeId !== filterEmployeeId) return false
    }
    // Ay filtresi (tüm ay seçili değilse)
    if (!showAllMonths) {
      const logDate = new Date(log.date)
      const logMonthStr = `${logDate.getFullYear()}-${String(logDate.getMonth() + 1).padStart(2, '0')}`
      if (logMonthStr !== filterMonth) return false
    }
    return true
  })

  // Toplam alacak ve ödenen miktarlar
  const unpaidLogs = filteredLogs.filter(l => l.status === 'ODENMEDI')
  const totalUnpaid = unpaidLogs.reduce((sum, l) => sum + l.amount, 0)
  const totalPaid = filteredLogs.filter(l => l.status === 'ODENDI').reduce((sum, l) => sum + l.amount, 0)

  // Toplu ödeme seçim işlemleri
  const selectableLogs = filteredLogs.filter(log => log.status === 'ODENMEDI')
  const isAllSelected = selectableLogs.length > 0 && selectableLogs.every(log => selectedLogs.includes(log.id))

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedLogs(selectableLogs.map(log => log.id))
    } else {
      setSelectedLogs([])
    }
  }

  const handleBulkPay = () => {
    showConfirm(`Seçilen ${selectedLogs.length} adet çalışma gününü toplu olarak "Ödendi" olarak işaretlemek istediğinizden emin misiniz?`, async () => {
      try {
        const res = await fetch('/api/worklogs', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-requester-id': currentUser?.id || '',
            'x-requester-role': currentUser?.role || ''
          },
          body: JSON.stringify({
            ids: selectedLogs,
            status: 'ODENDI'
          })
        })

        if (res.ok) {
          setSelectedLogs([])
          fetchLogs()
          addToast('Seçilen yevmiyeler toplu olarak ödendi yapıldı ve kasa giderleri oluşturuldu.', 'success')
        } else {
          const err = await res.json()
          addToast(err.error || 'Toplu güncelleme başarısız.', 'error')
        }
      } catch (err) {
        console.error(err)
      }
    })
  }

  // Personel kendi eşleşmesini yapmadıysa uyarı ver
  if (!isAdmin && !myEmployee && !loading) {
    return (
      <div className="p-8 rounded-2xl glass border border-amber-500/20 text-center space-y-4 animate-fade-in max-w-xl mx-auto my-12">
        <Clock className="w-12 h-12 text-amber-400 mx-auto animate-pulse" />
        <h3 className="text-xl font-bold text-white">Çalışan Profil Eşleşmesi Bulunamadı</h3>
        <p className="text-sm text-gray-400 leading-relaxed">
          Kendi adınıza çalışma günü kaydedebilmeniz için yöneticinizin **Kullanıcılar** sekmesinden sizin hesabınızla bir çalışan profilini eşleştirmesi gerekmektedir. 
          Lütfen sistem yöneticinizle iletişime geçin.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Title */}
      <div>
        <h2 className="text-3xl font-extrabold tracking-tight glow-text text-white">İş Kayıt Defteri</h2>
        <p className="text-gray-400 mt-1">
          {isAdmin 
            ? 'Çalışanların mesai ve çalışma günlerini yönetin, ödemelerini takip edin.'
            : `${myEmployee?.name} olarak çalıştığınız günleri ve yevmiyelerinizi takip edin.`}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="p-5 rounded-2xl glass border border-rose-500/10 flex justify-between items-center">
          <div>
            <span className="text-[10px] text-gray-400 block uppercase font-bold tracking-wider">
              {isAdmin ? 'Toplam Bekleyen Ödemeler' : 'Hak Edilen Alacak'}
            </span>
            <span className="text-xl font-bold text-rose-400 mt-1 block">
              {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(totalUnpaid)}
            </span>
          </div>
          <div className="p-2.5 bg-rose-500/10 rounded-xl text-rose-400">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 rounded-2xl glass border border-emerald-500/10 flex justify-between items-center">
          <div>
            <span className="text-[10px] text-gray-400 block uppercase font-bold tracking-wider">
              {isAdmin ? 'Toplam Yapılan Ödemeler' : 'Alınan Toplam Ödeme'}
            </span>
            <span className="text-xl font-bold text-emerald-400 mt-1 block">
              {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(totalPaid)}
            </span>
          </div>
          <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400">
            <Check className="w-5 h-5" />
          </div>
        </div>

        {isAdmin && (
          <div className="p-5 rounded-2xl glass border border-violet-500/10">
            <label className="text-[10px] text-gray-400 block uppercase font-bold tracking-wider mb-2">Çalışan Filtresi</label>
            <select
              value={filterEmployeeId}
              onChange={(e) => setFilterEmployeeId(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-xl bg-violet-950/20 border border-violet-500/10 text-white focus:outline-none focus:border-violet-500 transition cursor-pointer"
            >
              <option value="" className="bg-[#05020c] text-white">Tüm Çalışanlar</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id} className="bg-[#05020c] text-white">
                  {emp.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Input Form */}
        <div className="p-6 rounded-2xl glass-card h-fit space-y-4">
          <h3 className="font-bold text-lg text-white flex items-center gap-2 pb-2 border-b border-violet-500/10">
            <CalendarIcon className="w-5 h-5 text-violet-400" />
            <span>Çalışma Günü Ekle</span>
          </h3>

          <form onSubmit={handleAddLog} className="space-y-4 text-left">
            {isAdmin && (
              <div>
                <label className="text-xs text-gray-400 block mb-1">Çalışan Seçin</label>
                <select
                  value={form.employeeId}
                  onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                  required
                  className="w-full text-sm px-4 py-2.5 rounded-xl bg-violet-950/20 border border-violet-500/10 text-white focus:outline-none focus:border-violet-500 transition cursor-pointer"
                >
                  <option value="" className="bg-[#05020c] text-gray-400">Çalışan seçin...</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id} className="bg-[#05020c] text-white">
                      {emp.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="text-xs text-gray-400 block mb-1">Çalışma Tarihi</label>
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full text-sm px-4 py-2.5 rounded-xl bg-violet-950/20 border border-violet-500/10 text-white focus:outline-none focus:border-violet-500 transition"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Çalışma Süresi / Yevmiye</label>
              <div className="grid grid-cols-3 gap-1">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, type: 'TAM' })}
                  className={`py-2 px-2.5 rounded-xl text-xs font-semibold border transition ${
                    form.type === 'TAM'
                      ? 'bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-600/20'
                      : 'bg-violet-950/10 border-violet-500/10 text-gray-400 hover:text-white'
                  }`}
                >
                  Tam Gün
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, type: 'YARIM' })}
                  className={`py-2 px-2.5 rounded-xl text-xs font-semibold border transition ${
                    form.type === 'YARIM'
                      ? 'bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-600/20'
                      : 'bg-violet-950/10 border-violet-500/10 text-gray-400 hover:text-white'
                  }`}
                >
                  Yarım Gün
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, type: 'UZAKTAN' })}
                  className={`py-2 px-2.5 rounded-xl text-xs font-semibold border transition ${
                    form.type === 'UZAKTAN'
                      ? 'bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-600/20'
                      : 'bg-violet-950/10 border-violet-500/10 text-gray-400 hover:text-white'
                  }`}
                >
                  Uzaktan
                </button>
              </div>

              {form.type === 'UZAKTAN' ? (
                <div className="space-y-3 mt-3 animate-fade-in">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Özel Tutar (₺)</label>
                    <input
                      type="number"
                      required
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      placeholder="Örnek: 1500"
                      className="w-full text-sm px-4 py-2.5 rounded-xl bg-violet-950/20 border border-violet-500/10 text-white focus:outline-none focus:border-violet-500 transition"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Açıklama</label>
                    <textarea
                      required
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder="Yapılan iş / görev açıklaması..."
                      rows={2}
                      className="w-full text-sm px-4 py-2.5 rounded-xl bg-violet-950/20 border border-violet-500/10 text-white focus:outline-none focus:border-violet-500 transition resize-none"
                    />
                  </div>
                </div>
              ) : (
                <p className="text-[10px] text-gray-500 mt-2">
                  {!isAdmin && myEmployee && (
                    <span>
                      Ücretlendirme: Tam gün {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(myEmployee.fullDayRate)} | Yarım gün {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(myEmployee.halfDayRate)}
                    </span>
                  )}
                  {isAdmin && form.employeeId && (
                    (() => {
                      const selected = employees.find(emp => emp.id === form.employeeId)
                      return selected ? (
                        <span>
                          Ücretlendirme: Tam gün {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(selected.fullDayRate)} | Yarım gün {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(selected.halfDayRate)}
                        </span>
                      ) : null
                    })()
                  )}
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Günü Kaydet</span>
            </button>
          </form>
        </div>

        {/* Right: History */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="font-bold text-lg text-white">Çalışma Geçmişi</h3>
            <div className="flex items-center gap-2">
              {/* Ay Navigasyonu */}
              <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-violet-950/30 border border-violet-500/15">
                <button
                  onClick={prevFilterMonth}
                  className="p-1 hover:bg-violet-950/40 rounded-lg text-violet-400 transition cursor-pointer"
                  title="Önceki Ay"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-bold text-violet-300 min-w-[100px] text-center">{filterMonthLabel}</span>
                <button
                  onClick={nextFilterMonth}
                  disabled={isCurrentFilterMonth}
                  className="p-1 hover:bg-violet-950/40 rounded-lg text-violet-400 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Sonraki Ay"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              {/* Tüm aylar toggle */}
              <button
                onClick={() => setShowAllMonths(v => !v)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                  showAllMonths
                    ? 'bg-violet-600 border-violet-500 text-white'
                    : 'bg-violet-950/20 border-violet-500/20 text-gray-400 hover:text-white'
                }`}
              >
                Tüm Aylar
              </button>
            </div>
          </div>

          {/* Seçilen Ay Özet Kutusu */}
          {!showAllMonths && (
            <div className="flex gap-3 text-xs">
              <span className="px-3 py-1.5 rounded-xl bg-violet-950/20 border border-violet-500/10 text-violet-300">
                <span className="text-gray-500 mr-1">Kayıt:</span>
                <span className="font-bold">{filteredLogs.length}</span>
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-rose-950/20 border border-rose-500/10 text-rose-300">
                <span className="text-gray-500 mr-1">Bekleyen:</span>
                <span className="font-bold">{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(filteredLogs.filter(l => l.status === 'ODENMEDI').reduce((s,l) => s + l.amount, 0))}</span>
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-emerald-950/20 border border-emerald-500/10 text-emerald-300">
                <span className="text-gray-500 mr-1">Ödenen:</span>
                <span className="font-bold">{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(filteredLogs.filter(l => l.status === 'ODENDI').reduce((s,l) => s + l.amount, 0))}</span>
              </span>
            </div>
          )}

          {isAdmin && selectedLogs.length > 0 && (
              <div className="flex items-center gap-2 p-2 rounded-xl bg-violet-600/10 border border-violet-500/20 animate-fade-in">
                <span className="text-xs font-semibold text-violet-300">
                  {selectedLogs.length} adet seçildi
                </span>
                <button
                  onClick={handleBulkPay}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold rounded-lg flex items-center gap-1 transition cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Toplu Öde</span>
                </button>
                <button
                  onClick={() => setSelectedLogs([])}
                  className="p-1 bg-violet-950/40 hover:bg-violet-950/60 border border-violet-500/20 text-gray-300 rounded-lg transition cursor-pointer"
                  title="Seçimi Kaldır"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

          {loading ? (
            <div className="py-24 flex justify-center items-center rounded-2xl glass">
              <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-24 text-gray-500 text-sm rounded-2xl glass">
              {showAllMonths ? 'Kayıtlı çalışma mesaisi bulunamadı.' : `${filterMonthLabel} ayına ait çalışma kaydı bulunamadı.`}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-violet-500/10 glass max-h-[60vh] overflow-y-auto pr-1">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-violet-500/10 text-xs text-gray-500 uppercase tracking-wider bg-violet-950/10">
                    {isAdmin && (
                      <th className="p-4 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={isAllSelected}
                          onChange={handleSelectAll}
                          disabled={selectableLogs.length === 0}
                          className="w-4 h-4 rounded border-violet-500/30 text-violet-600 focus:ring-violet-500/20 bg-violet-950/20 cursor-pointer"
                        />
                      </th>
                    )}
                    <th className="p-4">Tarih</th>
                    {isAdmin && <th className="p-4">Çalışan</th>}
                    <th className="p-4">Yevmiye Türü</th>
                    <th className="p-4">Tutar</th>
                    <th className="p-4">Ödeme Durumu</th>
                    <th className="p-4 text-center">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className={`border-b border-violet-500/5 hover:bg-violet-950/10 text-sm text-gray-300 transition-colors ${selectedLogs.includes(log.id) ? 'bg-violet-600/5' : ''}`}>
                      {isAdmin && (
                        <td className="p-4 text-center">
                          {log.status === 'ODENMEDI' ? (
                            <input
                              type="checkbox"
                              checked={selectedLogs.includes(log.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedLogs([...selectedLogs, log.id])
                                } else {
                                  setSelectedLogs(selectedLogs.filter(id => id !== log.id))
                                }
                              }}
                              className="w-4 h-4 rounded border-violet-500/30 text-violet-600 focus:ring-violet-500/20 bg-violet-950/20 cursor-pointer"
                            />
                          ) : (
                            <span className="w-4 h-4 inline-block" />
                          )}
                        </td>
                      )}
                      <td className="p-4 font-medium whitespace-nowrap">
                        {new Date(log.date).toLocaleDateString('tr-TR')}
                      </td>
                      {isAdmin && (
                        <td className="p-4 font-bold text-white">
                          {log.employee?.name}
                        </td>
                      )}
                      <td className="p-4">
                        <span className={`px-2 py-0.5 text-[10px] rounded-full font-bold border ${
                          log.type === 'TAM'
                            ? 'bg-violet-500/10 text-violet-400 border-violet-500/20'
                            : log.type === 'YARIM'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-teal-500/10 text-teal-400 border-teal-500/20'
                        }`}>
                          {log.type === 'TAM' ? 'TAM GÜN' : log.type === 'YARIM' ? 'YARIM GÜN' : 'UZAKTAN'}
                        </span>
                        {log.type === 'UZAKTAN' && log.description && (
                          <div className="text-xs text-gray-400 mt-1 max-w-[180px] break-words italic">
                            {log.description}
                          </div>
                        )}
                      </td>
                      <td className="p-4 font-bold text-white">
                        {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(log.amount)}
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 text-[10px] rounded-full font-bold border ${
                          log.status === 'ODENDI'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}>
                          {log.status === 'ODENDI' ? 'ÖDENDİ' : 'ÖDENMEDİ'}
                        </span>
                      </td>
                      <td className="p-4 text-center flex items-center justify-center gap-2">
                        {isAdmin && log.status === 'ODENMEDI' && (
                          <button
                            onClick={() => handleMarkPaid(log.id)}
                            className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-lg transition cursor-pointer"
                            title="Ödendi Yap"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                        {(isAdmin || log.status === 'ODENMEDI') ? (
                          <button
                            onClick={() => handleDeleteLog(log.id)}
                            className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg transition cursor-pointer"
                            title="Kaydı Sil"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : (
                          <span className="p-1 text-gray-600" title="Ödenmiş kayıtlar kilitlidir.">
                            <Lock className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
