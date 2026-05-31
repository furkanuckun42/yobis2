'use client'

import { useState, useEffect } from 'react'
import { 
  Users, 
  Plus, 
  Trash2, 
  Edit3, 
  DollarSign, 
  Phone, 
  Link, 
  StickyNote, 
  Save, 
  CheckCircle, 
  XCircle,
  Briefcase,
  Calendar
} from 'lucide-react'

export default function Customers({ onAction, currentUser, addToast, showConfirm }) {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [rightTab, setRightTab] = useState('profile') // 'profile', 'projects'
  const [searchTerm, setSearchTerm] = useState('')
  
  // Form State
  const [form, setForm] = useState({
    name: '',
    phone: '',
    instagram: '',
    notes: '',
    monthlyIncome: '',
    startingBalance: '',
    currentBalance: ''
  })
  const [isEditing, setIsEditing] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const isAdmin = currentUser?.role === 'admin'

  // Fetch Customers
  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/customers')
      const json = await res.json()
      if (res.ok) {
        setCustomers(json)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCustomers()
  }, [])

  useEffect(() => {
    if (selectedCustomer) {
      const fresh = customers.find(c => c.id === selectedCustomer.id)
      if (fresh) {
        setSelectedCustomer(fresh)
      }
    }
  }, [customers])

  const resetForm = () => {
    setForm({
      name: '',
      phone: '',
      instagram: '',
      notes: '',
      monthlyIncome: '',
      startingBalance: '',
      currentBalance: ''
    })
    setIsEditing(false)
    setSelectedCustomer(null)
    setRightTab('profile')
    setSearchTerm('')
  }

  const handleSelectCustomer = (customer) => {
    setSelectedCustomer(customer)
    setForm({
      name: customer.name,
      phone: customer.phone || '',
      instagram: customer.instagram || '',
      notes: customer.notes || '',
      monthlyIncome: customer.monthlyIncome.toString(),
      startingBalance: customer.startingBalance.toString(),
      currentBalance: customer.currentBalance.toString()
    })
    setIsEditing(true)
    setRightTab('profile')
  }

  // Handle Create or Update
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return

    const method = isEditing ? 'PUT' : 'POST'
    const bodyData = isEditing 
      ? { id: selectedCustomer.id, ...form } 
      : form

    try {
      const res = await fetch('/api/customers', {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'x-requester-role': currentUser?.role || ''
        },
        body: JSON.stringify(bodyData)
      })

      if (res.ok) {
        fetchCustomers()
        resetForm()
        if (onAction) onAction() // Refresh Dashboard metrics if needed
      } else {
        const err = await res.json()
        addToast(err.error || 'İşlem başarısız', 'error')
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Handle Delete
  const handleDelete = async (id) => {
    showConfirm('Bu müşteriyi silmek istediğinizden emin misiniz? (İlişkili tüm projeler de silinecektir!)', async () => {
      try {
        const res = await fetch(`/api/customers?id=${id}`, { method: 'DELETE' })
        if (res.ok) {
          fetchCustomers()
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

  // Handle Quick Payment
  const handleQuickPayment = async (e) => {
    e.preventDefault()
    if (!selectedCustomer || !payAmount || parseFloat(payAmount) <= 0) return

    try {
      const res = await fetch('/api/customers', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'x-requester-role': currentUser?.role || ''
        },
        body: JSON.stringify({
          id: selectedCustomer.id,
          payAmount: parseFloat(payAmount)
        })
      })

      if (res.ok) {
        const updatedCustomer = await res.json()
        setSelectedCustomer(updatedCustomer)
        setPayAmount('')
        fetchCustomers()
        if (onAction) onAction()
      } else {
        const err = await res.json()
        addToast(err.error || 'Ödeme düşülemedi', 'error')
      }
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Title */}
      <div>
        <h2 className="text-3xl font-extrabold tracking-tight glow-text text-white">Müşteri Portföyü (Alacaklarımız)</h2>
        <p className="text-gray-400 mt-1">Müşteri hesaplarını izleyin, tahsilatları yapın ve müşteri profillerini düzenleyin.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left/Middle Column: Customer list (2/3 width) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-lg text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-violet-400" />
              <span>Müşteri Listesi</span>
            </h3>
            {isEditing && isAdmin && (
              <button 
                onClick={resetForm}
                className="text-xs px-3 py-1.5 bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 border border-violet-500/20 rounded-lg font-semibold transition cursor-pointer"
              >
                Yeni Müşteri Ekle
              </button>
            )}
          </div>

          {/* Arama Girişi */}
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Müşteri adı, telefon veya instagram ile ara..."
              className="w-full text-xs px-4 py-2.5 rounded-xl bg-violet-950/20 border border-violet-500/10 text-white focus:outline-none focus:border-violet-500/40 placeholder:text-gray-600 transition"
            />
          </div>

          {loading ? (
            <div className="py-24 flex justify-center items-center rounded-2xl glass">
              <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : customers.length === 0 ? (
            <div className="text-center py-24 text-gray-500 text-sm rounded-2xl glass">
              Henüz kayıtlı müşteri yok. Sağdaki formu kullanarak ekleyin.
            </div>
          ) : (() => {
            const filtered = customers.filter(c => 
              c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
              (c.phone && c.phone.includes(searchTerm)) ||
              (c.instagram && c.instagram.toLowerCase().includes(searchTerm.toLowerCase()))
            )
            return filtered.length === 0 ? (
              <div className="text-center py-24 text-gray-500 text-sm rounded-2xl glass border border-violet-500/5">
                Aramayla eşleşen müşteri bulunamadı.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto pr-2">
                {filtered.map((c) => {
                const isSelected = selectedCustomer?.id === c.id
                return (
                  <div
                    key={c.id}
                    onClick={() => handleSelectCustomer(c)}
                    className={`p-5 rounded-2xl cursor-pointer text-left transition-all border ${
                      isSelected
                        ? 'bg-violet-950/40 border-violet-500 glow-purple shadow-lg'
                        : 'glass-card border-violet-500/10'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-base text-white">{c.name}</h4>
                        {c.phone && (
                          <p className="text-xs text-gray-400 flex items-center gap-1.5 mt-1">
                            <Phone className="w-3.5 h-3.5" />
                            <span>{c.phone}</span>
                          </p>
                        )}
                        {c.instagram && (
                          <p className="text-xs text-gray-400 flex items-center gap-1.5 mt-1">
                            <Link className="w-3.5 h-3.5 text-pink-400/80" />
                            <span>@{c.instagram}</span>
                          </p>
                        )}
                      </div>
                      {isAdmin && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(c.id)
                          }}
                          className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg transition cursor-pointer"
                          title="Müşteriyi Sil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-violet-500/5 text-xs">
                      <div>
                        <span className="text-[10px] text-gray-500 block uppercase font-bold tracking-wider">Aylık Tahmini Gelir</span>
                        <span className="font-semibold text-white">
                          {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(c.monthlyIncome)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 block uppercase font-bold tracking-wider">Net Cari Bakiye</span>
                        <span className={`font-black ${c.currentBalance > 0 ? 'text-rose-400' : c.currentBalance < 0 ? 'text-emerald-400' : 'text-gray-400'}`}>
                          {c.currentBalance > 0 ? 'Borçlu: ' : c.currentBalance < 0 ? 'Alacaklı: ' : ''}
                          {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(Math.abs(c.currentBalance))}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) })() }
        </div>

        {/* Right Column: Add/Edit Form & Pay tools & Projects */}
        <div className="space-y-6">
          {/* Tab Navigation if selectedCustomer */}
          {selectedCustomer && (
            <div className="flex p-1 bg-violet-950/20 border border-violet-500/10 rounded-xl w-full">
              <button
                type="button"
                onClick={() => setRightTab('profile')}
                className={`flex-1 py-2 text-center rounded-lg text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  rightTab === 'profile' ? 'bg-violet-600 text-white shadow-md' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Profil & Tahsilat</span>
              </button>
              <button
                type="button"
                onClick={() => setRightTab('projects')}
                className={`flex-1 py-2 text-center rounded-lg text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  rightTab === 'projects' ? 'bg-violet-600 text-white shadow-md' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Briefcase className="w-3.5 h-3.5" />
                <span>Çalışmalar ({selectedCustomer.projects?.length || 0})</span>
              </button>
            </div>
          )}

          {/* Tab 1: Profile & Tahsilat */}
          {(!selectedCustomer || rightTab === 'profile') && (
            <>
              {/* Main customer profile form */}
              {isAdmin ? (
                <div className="p-6 rounded-2xl glass-card space-y-4">
                  <h3 className="font-bold text-lg text-white flex items-center gap-2 pb-2 border-b border-violet-500/10">
                    <Edit3 className="w-5 h-5 text-violet-400" />
                    <span>{isEditing ? 'Profili Düzenle' : 'Yeni Müşteri Ekle'}</span>
                  </h3>

                  <form onSubmit={handleSubmit} className="space-y-4 text-left">
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Müşteri / Şirket Adı</label>
                      <input
                        type="text"
                        required
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="Örn: X Film Prodüksiyon"
                        className="w-full text-sm px-4 py-2.5 rounded-xl bg-violet-950/20 border border-violet-500/10 text-white focus:outline-none focus:border-violet-500/40 focus:bg-violet-950/30 transition"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Telefon</label>
                        <input
                          type="text"
                          value={form.phone}
                          onChange={(e) => setForm({ ...form, phone: e.target.value })}
                          placeholder="05..."
                          className="w-full text-sm px-4 py-2.5 rounded-xl bg-violet-950/20 border border-violet-500/10 text-white focus:outline-none focus:border-violet-500/40 focus:bg-violet-950/30 transition"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Instagram</label>
                        <input
                          type="text"
                          value={form.instagram}
                          onChange={(e) => setForm({ ...form, instagram: e.target.value })}
                          placeholder="kullanici_adi"
                          className="w-full text-sm px-4 py-2.5 rounded-xl bg-violet-950/20 border border-violet-500/10 text-white focus:outline-none focus:border-violet-500/40 focus:bg-violet-950/30 transition"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Özel Notlar</label>
                      <textarea
                        value={form.notes}
                        onChange={(e) => setForm({ ...form, notes: e.target.value })}
                        placeholder="Müşteriyle ilgili detaylar..."
                        rows={2}
                        className="w-full text-sm px-4 py-2.5 rounded-xl bg-violet-950/20 border border-violet-500/10 text-white focus:outline-none focus:border-violet-500/40 focus:bg-violet-950/30 transition resize-none"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Aylık Gelir</label>
                        <input
                          type="number"
                          value={form.monthlyIncome}
                          onChange={(e) => setForm({ ...form, monthlyIncome: e.target.value })}
                          placeholder="0.00"
                          className="w-full text-xs px-2.5 py-2.5 rounded-xl bg-[#0a0518] border border-violet-500/10 text-white focus:outline-none focus:border-violet-500/40 transition"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Başl. Borcu (₺)</label>
                        <input
                          type="number"
                          value={form.startingBalance}
                          onChange={(e) => setForm({ ...form, startingBalance: e.target.value })}
                          placeholder="0.00"
                          className="w-full text-xs px-2.5 py-2.5 rounded-xl bg-[#0a0518] border border-violet-500/10 text-white focus:outline-none focus:border-violet-500/40 transition"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Mevcut Borç (₺)</label>
                        <input
                          type="number"
                          value={form.currentBalance}
                          onChange={(e) => setForm({ ...form, currentBalance: e.target.value })}
                          placeholder="0.00"
                          className="w-full text-xs px-2.5 py-2.5 rounded-xl bg-[#0a0518] border border-violet-500/10 text-white focus:outline-none focus:border-violet-500/40 transition"
                        />
                      </div>
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
              ) : (
                <div className="p-6 rounded-2xl glass-card text-center text-gray-400 text-sm">
                  Müşteri profili oluşturma ve düzenleme yetkisi sadece **Yöneticilerdedir**. Seçtiğiniz müşterilerden ödeme alabilirsiniz.
                </div>
              )}

              {/* Quick Payment tool — Tüm Kullanıcılar */}
              {selectedCustomer && (
                <div className="p-6 rounded-2xl glass-card space-y-4 border border-emerald-500/20">
                  <h3 className="font-bold text-lg text-white flex items-center gap-2 pb-2 border-b border-emerald-500/10">
                    <DollarSign className="w-5 h-5 text-emerald-400" />
                    <span>Müşteriden Ödeme Al (Tahsilat)</span>
                  </h3>

                  <div className="text-xs text-gray-400 text-left">
                    Müşteri: <strong className="text-white">{selectedCustomer.name}</strong><br/>
                    Kalan Borç: <strong className={selectedCustomer.currentBalance > 0 ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                      {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(selectedCustomer.currentBalance)}
                    </strong>
                  </div>

                  <form onSubmit={handleQuickPayment} className="space-y-3 text-left">
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Tahsil Edilen Tutar (Kasaya Eklenir)</label>
                      <input
                        type="number"
                        required
                        min="0.01"
                        step="0.01"
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full text-sm px-4 py-2.5 rounded-xl bg-violet-950/20 border border-violet-500/10 text-white focus:outline-none focus:border-violet-500/40 focus:bg-violet-950/30 transition"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition cursor-pointer"
                    >
                      Ödemeyi Onayla (Alacaktan Düş)
                    </button>
                  </form>
                </div>
              )}
            </>
          )}

          {/* Tab 2: Çalışmalar */}
          {selectedCustomer && rightTab === 'projects' && (() => {
            const now = new Date()
            const currentMonth = now.getMonth()
            const currentYear = now.getFullYear()

            const monthlyProjects = selectedCustomer.projects?.filter(p => {
              if (p.isArchived) return false
              const d = new Date(p.deliveryDate)
              return d.getMonth() === currentMonth && d.getFullYear() === currentYear
            }) || []

            const archivedProjects = selectedCustomer.projects?.filter(p => p.isArchived) || []

            const otherActiveProjects = selectedCustomer.projects?.filter(p => {
              if (p.isArchived) return false
              const d = new Date(p.deliveryDate)
              return !(d.getMonth() === currentMonth && d.getFullYear() === currentYear)
            }) || []

            const getPercentage = (st) => {
              if (st === 'Teklif Aşamasında') return '%15 İlerleme'
              if (st === 'Devam Ediyor') return '%40 İlerleme'
              if (st === 'Revize Bekliyor') return '%65 İlerleme'
              if (st === 'Teslime Hazır') return '%85 İlerleme'
              return '%100 Tamamlandı'
            }

            return (
              <div className="p-6 rounded-2xl glass-card space-y-6 text-left max-h-[75vh] overflow-y-auto">
                <h3 className="font-bold text-lg text-white flex items-center gap-2 pb-2 border-b border-violet-500/10">
                  <Briefcase className="w-5 h-5 text-violet-400" />
                  <span>Müşteri Çalışmaları</span>
                </h3>

                {/* Bu Ayki Çalışmalar */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-violet-400 uppercase tracking-wider flex justify-between items-center">
                    <span>Bu Ayın Çalışmaları ({monthlyProjects.length})</span>
                    <span className="text-[10px] text-gray-500 font-normal lowercase">teslim tarihi bu ay olanlar</span>
                  </h4>
                  {monthlyProjects.length === 0 ? (
                    <p className="text-xs text-gray-500 italic">Bu ay teslim edilecek aktif çalışma yok.</p>
                  ) : (
                    <div className="space-y-2">
                      {monthlyProjects.map(p => (
                        <div key={p.id} className="p-3 bg-violet-950/20 border border-violet-500/10 rounded-xl space-y-1.5 hover:border-violet-500/30 transition">
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-semibold text-white text-xs">{p.name}</span>
                            <span className="text-[10px] font-bold text-violet-300">
                              {getPercentage(p.stage)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-[10px] text-gray-400">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-violet-400" />
                              {new Date(p.deliveryDate).toLocaleDateString('tr-TR')}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-violet-500/10 border border-violet-500/20 text-[9px] font-semibold">
                              {p.stage}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Diğer Aktif Çalışmalar */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-violet-400 uppercase tracking-wider flex justify-between items-center">
                    <span>Diğer Aktif Çalışmalar ({otherActiveProjects.length})</span>
                    <span className="text-[10px] text-gray-500 font-normal lowercase">diğer aylarda teslim edilecek</span>
                  </h4>
                  {otherActiveProjects.length === 0 ? (
                    <p className="text-xs text-gray-500 italic">Diğer aylara ait aktif çalışma yok.</p>
                  ) : (
                    <div className="space-y-2">
                      {otherActiveProjects.map(p => (
                        <div key={p.id} className="p-3 bg-violet-950/10 border border-violet-500/5 rounded-xl space-y-1.5 hover:border-violet-500/20 transition">
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-semibold text-white text-xs">{p.name}</span>
                            <span className="text-[10px] font-bold text-violet-300">
                              {getPercentage(p.stage)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-[10px] text-gray-400">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-violet-400" />
                              {new Date(p.deliveryDate).toLocaleDateString('tr-TR')}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-violet-500/5 border border-violet-500/10 text-[9px] font-semibold">
                              {p.stage}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Arşivlenmiş Çalışmalar */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Arşivlenmiş Çalışmalar ({archivedProjects.length})
                  </h4>
                  {archivedProjects.length === 0 ? (
                    <p className="text-xs text-gray-500 italic">Arşivlenmiş çalışma yok.</p>
                  ) : (
                    <div className="space-y-2">
                      {archivedProjects.map(p => (
                        <div key={p.id} className="p-3 bg-slate-950/20 border border-slate-800 rounded-xl space-y-1.5 opacity-75">
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-semibold text-gray-300 text-xs">{p.name}</span>
                          </div>
                          <div className="flex justify-between items-center text-[10px] text-gray-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(p.deliveryDate).toLocaleDateString('tr-TR')}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-gray-500/10 border border-gray-800 text-[9px] font-semibold">
                              Arşivlendi
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}
