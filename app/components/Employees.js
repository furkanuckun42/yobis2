'use client'

import { useState, useEffect } from 'react'
import { 
  Users, 
  Plus, 
  Trash2, 
  Edit3, 
  DollarSign, 
  Save, 
  UserCheck,
  TrendingUp,
  Award
} from 'lucide-react'

export default function Employees({ currentUser, addToast, showConfirm }) {
  const [employees, setEmployees] = useState([])
  const [users, setUsers] = useState([])
  const [workLogs, setWorkLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedEmployee, setSelectedEmployee] = useState(null)

  // Form State
  const [form, setForm] = useState({
    name: '',
    userId: '',
    fullDayRate: '',
    halfDayRate: '',
    iban: '',
    notes: ''
  })
  const [isEditing, setIsEditing] = useState(false)

  const fetchEmployees = async () => {
    try {
      const res = await fetch('/api/employees')
      if (res.ok) {
        const json = await res.json()
        setEmployees(json)
      }
    } catch (err) {
      console.error(err)
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

  const fetchWorkLogs = async () => {
    try {
      const res = await fetch('/api/worklogs', {
        headers: {
          'x-requester-id': currentUser?.id || '',
          'x-requester-role': currentUser?.role || ''
        }
      })
      if (res.ok) {
        const json = await res.json()
        setWorkLogs(json)
      }
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await Promise.all([fetchEmployees(), fetchUsers(), fetchWorkLogs()])
      setLoading(false)
    }
    init()
  }, [])

  const resetForm = () => {
    setForm({
      name: '',
      userId: '',
      fullDayRate: '',
      halfDayRate: '',
      iban: '',
      notes: ''
    })
    setIsEditing(false)
    setSelectedEmployee(null)
  }

  const handleSelectEmployee = (emp) => {
    setSelectedEmployee(emp)
    setForm({
      name: emp.name,
      userId: emp.userId || '',
      fullDayRate: emp.fullDayRate.toString(),
      halfDayRate: emp.halfDayRate.toString(),
      iban: emp.iban || '',
      notes: emp.notes || ''
    })
    setIsEditing(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return

    const method = isEditing ? 'PUT' : 'POST'
    const bodyData = isEditing ? { id: selectedEmployee.id, ...form } : form

    try {
      const res = await fetch('/api/employees', {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-requester-role': currentUser?.role || ''
        },
        body: JSON.stringify(bodyData)
      })

      if (res.ok) {
        await Promise.all([fetchEmployees(), fetchWorkLogs()])
        resetForm()
      } else {
        const err = await res.json()
        addToast(err.error || 'İşlem başarısız', 'error')
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleDelete = async (id) => {
    showConfirm('Bu çalışanı silmek istediğinizden emin misiniz? Çalışana ait tüm iş kayıtları da silinecektir.', async () => {
      try {
        const res = await fetch(`/api/employees?id=${id}`, {
          method: 'DELETE',
          headers: {
            'x-requester-role': currentUser?.role || ''
          }
        })
        if (res.ok) {
          await Promise.all([fetchEmployees(), fetchWorkLogs()])
          resetForm()
        } else {
          const err = await res.json()
          addToast(err.error || 'Silme başarısız', 'error')
        }
      } catch (err) {
        console.error(err)
      }
    })
  }

  // Her çalışanın toplam alacak (unpaid work logs) miktarını hesapla
  const calculateUnpaidAmount = (employeeId) => {
    return workLogs
      .filter(log => log.employeeId === employeeId && log.status === 'ODENMEDI')
      .reduce((sum, log) => sum + log.amount, 0)
  }

  // Zaten bir çalışanla eşleştirilmiş kullanıcı ID'lerini bul
  const linkedUserIds = employees.map(emp => emp.userId).filter(uid => uid !== null && uid !== selectedEmployee?.userId)

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Title */}
      <div>
        <h2 className="text-3xl font-extrabold tracking-tight glow-text text-white">Çalışan Yönetimi</h2>
        <p className="text-gray-400 mt-1">Stüdyo ekibini tanımlayın, yevmiyelerini belirleyin ve sistem kullanıcılarıyla eşleştirin.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Employee List */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="font-bold text-lg text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-violet-400" />
            <span>Çalışan Listesi</span>
          </h3>

          {loading ? (
            <div className="py-24 flex justify-center items-center rounded-2xl glass">
              <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : employees.length === 0 ? (
            <div className="text-center py-24 text-gray-500 text-sm rounded-2xl glass">
              Kayıtlı çalışan bulunmuyor. Sağdaki formu kullanarak ekleyin.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto pr-2">
              {employees.map((emp) => {
                const isSelected = selectedEmployee?.id === emp.id
                const unpaid = calculateUnpaidAmount(emp.id)
                return (
                  <div
                    key={emp.id}
                    onClick={() => handleSelectEmployee(emp)}
                    className={`p-5 rounded-2xl cursor-pointer text-left transition-all border ${
                      isSelected
                        ? 'bg-violet-950/40 border-violet-500 glow-purple shadow-lg'
                        : 'glass-card border-violet-500/10 hover:border-violet-500/20'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-base text-white flex items-center gap-1.5">
                          <Award className="w-4 h-4 text-violet-400" />
                          {emp.name}
                        </h4>
                        {emp.user ? (
                          <p className="text-xs text-emerald-400 flex items-center gap-1.5 mt-1">
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Eşleşen: @{emp.user.username} ({emp.user.displayName || emp.user.username})</span>
                          </p>
                        ) : (
                          <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-1">
                            <UserCheck className="w-3.5 h-3.5" />
                            <span className="italic">Kullanıcı eşleşmesi yok</span>
                          </p>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(emp.id)
                        }}
                        className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg transition cursor-pointer"
                        title="Çalışanı Sil"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                      {emp.iban && (
                        <div className="mt-3 pt-3 border-t border-violet-500/5">
                          <span className="text-[9px] block uppercase font-bold tracking-wider text-gray-500">IBAN</span>
                          <span className="font-mono text-xs text-gray-300 break-all">{emp.iban}</span>
                        </div>
                      )}

                    <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-violet-500/5 text-xs text-gray-400">
                      <div>
                        <span className="text-[9px] block uppercase font-bold tracking-wider">Tam Gün</span>
                        <span className="font-semibold text-white">
                          {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(emp.fullDayRate)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] block uppercase font-bold tracking-wider">Yarım Gün</span>
                        <span className="font-semibold text-white">
                          {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(emp.halfDayRate)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] block uppercase font-bold tracking-wider text-rose-400">Net Alacak</span>
                        <span className="font-bold text-rose-400">
                          {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(unpaid)}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right: Form */}
        <div className="p-6 rounded-2xl glass-card h-fit space-y-4">
          <h3 className="font-bold text-lg text-white flex items-center gap-2 pb-2 border-b border-violet-500/10">
            <Edit3 className="w-5 h-5 text-violet-400" />
            <span>{isEditing ? 'Profili Düzenle' : 'Yeni Çalışan Ekle'}</span>
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Çalışan Adı Soyadı</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Örn: Ahmet Yılmaz"
                className="w-full text-sm px-4 py-2.5 rounded-xl bg-violet-950/20 border border-violet-500/10 text-white focus:outline-none focus:border-violet-500 transition"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Kullanıcı Eşleştir</label>
              <select
                value={form.userId}
                onChange={(e) => setForm({ ...form, userId: e.target.value })}
                className="w-full text-sm px-4 py-2.5 rounded-xl bg-violet-950/20 border border-violet-500/10 text-white focus:outline-none focus:border-violet-500 transition cursor-pointer"
              >
                <option value="" className="bg-[#05020c] text-gray-400">Kullanıcı seçin (Opsiyonel)...</option>
                {users
                  .filter(u => !linkedUserIds.includes(u.id))
                  .map(u => (
                    <option key={u.id} value={u.id} className="bg-[#05020c] text-white">
                      {u.displayName || u.username} (@{u.username})
                    </option>
                  ))
                }
              </select>
              <p className="text-[10px] text-gray-500 mt-1.5 leading-relaxed">
                Bu eşleştirme yapıldığında, ilgili kullanıcının dashboard panelinde hak ettiği toplam alacak miktarı (beklenen ödeme) otomatik yansıtılır.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Tam Gün Ücreti (₺)</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={form.fullDayRate}
                  onChange={(e) => setForm({ ...form, fullDayRate: e.target.value })}
                  placeholder="0.00"
                  className="w-full text-sm px-4 py-2.5 rounded-xl bg-violet-950/20 border border-violet-500/10 text-white focus:outline-none focus:border-violet-500 transition"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Yarım Gün Ücreti (₺)</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={form.halfDayRate}
                  onChange={(e) => setForm({ ...form, halfDayRate: e.target.value })}
                  placeholder="0.00"
                  className="w-full text-sm px-4 py-2.5 rounded-xl bg-violet-950/20 border border-violet-500/10 text-white focus:outline-none focus:border-violet-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">IBAN (Banka Hesap No)</label>
              <input
                type="text"
                value={form.iban}
                onChange={(e) => setForm({ ...form, iban: e.target.value.replace(/\s/g, '') })}
                placeholder="TR000000000000000000000000"
                maxLength={34}
                className="w-full text-sm px-4 py-2.5 rounded-xl bg-violet-950/20 border border-violet-500/10 text-white font-mono focus:outline-none focus:border-violet-500 transition"
              />
              <p className="text-[10px] text-gray-500 mt-1">Boşluk olmadan girin, otomatik büyük harfe çevrilir.</p>
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Notlar</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Çalışan hakkında genel notlar..."
                rows={3}
                className="w-full text-sm px-4 py-2.5 rounded-xl bg-violet-950/20 border border-violet-500/10 text-white focus:outline-none focus:border-violet-500 transition resize-none"
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
                <span>{isEditing ? 'Güncelle' : 'Çalışan Ekle'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
