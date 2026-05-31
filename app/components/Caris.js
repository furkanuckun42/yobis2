'use client'

import { useState, useEffect } from 'react'
import { 
  Building2, 
  Plus, 
  Trash2, 
  Edit3, 
  DollarSign, 
  Phone, 
  StickyNote, 
  Save,
  CheckCircle,
  XCircle,
  Briefcase,
  Download,
  Printer
} from 'lucide-react'

export default function Caris({ onAction, currentUser, addToast, showConfirm }) {
  const [caris, setCaris] = useState([])
  const [financeRecords, setFinanceRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCari, setSelectedCari] = useState(null)
  
  // Form State
  const [form, setForm] = useState({
    name: '',
    phone: '',
    notes: '',
    startingBalance: ''
  })
  const [isEditing, setIsEditing] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const isAdmin = currentUser?.role === 'admin'

  // Fetch Caris
  const fetchCaris = async () => {
    try {
      const res = await fetch('/api/caris')
      const json = await res.json()
      if (res.ok) {
        setCaris(json)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchFinanceRecords = async () => {
    try {
      const res = await fetch('/api/finance')
      if (res.ok) {
        const json = await res.json()
        setFinanceRecords(json)
      }
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    fetchCaris()
    fetchFinanceRecords()
  }, [])

  const resetForm = () => {
    setForm({
      name: '',
      phone: '',
      notes: '',
      startingBalance: ''
    })
    setIsEditing(false)
    setSelectedCari(null)
    setShowEditForm(true) // Show profile form for adding new cari
  }

  const handleSelectCari = (cari) => {
    setSelectedCari(cari)
    setForm({
      name: cari.name,
      phone: cari.phone || '',
      notes: cari.notes || '',
      startingBalance: cari.startingBalance.toString()
    })
    setIsEditing(false)
    setShowEditForm(false) // Show monthly transaction history table by default
  }

  // Handle Create or Update
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return

    const method = isEditing ? 'PUT' : 'POST'
    const bodyData = isEditing 
      ? { id: selectedCari.id, ...form } 
      : form

    try {
      const res = await fetch('/api/caris', {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'x-requester-role': currentUser?.role || ''
        },
        body: JSON.stringify(bodyData)
      })

      if (res.ok) {
        fetchCaris()
        fetchFinanceRecords()
        resetForm()
        if (onAction) onAction() // Refresh Dashboard metrics
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
    showConfirm('Bu cari hesabı silmek istediğinizden emin misiniz?', async () => {
      try {
        const res = await fetch(`/api/caris?id=${id}`, {
          method: 'DELETE',
          headers: {
            'x-requester-role': currentUser?.role || ''
          }
        })
        if (res.ok) {
          fetchCaris()
          fetchFinanceRecords()
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

  // Handle Make Payment (Ödeme Yap)
  const handleMakePayment = async (e) => {
    e.preventDefault()
    if (!selectedCari || !payAmount || parseFloat(payAmount) <= 0) return

    try {
      const res = await fetch('/api/caris', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'x-requester-role': currentUser?.role || ''
        },
        body: JSON.stringify({
          id: selectedCari.id,
          payAmount: parseFloat(payAmount)
        })
      })

      if (res.ok) {
        const updatedCari = await res.json()
        setSelectedCari(updatedCari)
        setPayAmount('')
        fetchCaris()
        fetchFinanceRecords()
        if (onAction) onAction()
        addToast('Ödeme başarıyla kaydedildi, kasadan düşüldü.', 'success')
      } else {
        const err = await res.json()
        addToast(err.error || 'Ödeme düşülemedi', 'error')
      }
    } catch (err) {
      console.error(err)
    }
  }

  const exportCarisToCSV = () => {
    const headers = ['Firma Adı', 'Telefon', 'Notlar', 'Başlangıç Borcu', 'Kalan Borcumuz']
    const rows = caris.map(c => [
      c.name,
      c.phone || '',
      (c.notes || '').replace(/;/g, ' '),
      c.startingBalance.toString(),
      c.currentBalance.toString()
    ])
    const csvContent = "\uFEFF" + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `cari_hesap_listesi.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const exportCariTransactionsToCSV = (cari, monthRecords) => {
    const headers = ['Tarih', 'Açıklama', 'Tür', 'Tutar']
    const rows = monthRecords.map(r => [
      new Date(r.date).toLocaleDateString('tr-TR'),
      (r.description || '').replace(/;/g, ' '),
      r.type === 'GELIR' ? 'GELİR' : 'GİDER',
      r.amount.toString()
    ])
    const csvContent = "\uFEFF" + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `${cari.name.replace(/\s+/g, '_')}_hareket_gecmisi.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Title */}
      <div>
        <h2 className="text-3xl font-extrabold tracking-tight glow-text text-white">Cari Hesap Yönetimi (Borçlarımız)</h2>
        <p className="text-gray-400 mt-1">Borçlu olduğumuz firmaları takip edin, ödeme yapın ve cari hesapları yönetin.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Cari list */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-lg text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-amber-400" />
              <span>Cari Hesap Listesi</span>
            </h3>
            <div className="flex items-center gap-2">
              {caris.length > 0 && (
                <>
                  <button 
                    onClick={exportCarisToCSV}
                    className="text-xs px-2.5 py-1.5 bg-[#1b1406] hover:bg-amber-950/20 text-amber-400 border border-amber-500/20 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1"
                    title="Cari Listesini Excel Olarak İndir"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Excel</span>
                  </button>
                  <button 
                    onClick={() => window.print()}
                    className="text-xs px-2.5 py-1.5 bg-violet-950/20 border border-violet-500/10 text-gray-300 hover:text-white rounded-lg font-semibold transition cursor-pointer flex items-center gap-1"
                    title="Cari Listesini Yazdır"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Yazdır</span>
                  </button>
                </>
              )}
              {selectedCari && isAdmin && (
                <button 
                  onClick={() => {
                    setIsEditing(!isEditing || !showEditForm)
                    setShowEditForm(!showEditForm)
                  }}
                  className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                    showEditForm
                      ? 'bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 border border-amber-500/20'
                      : 'bg-violet-600 hover:bg-violet-500 text-white'
                  }`}
                >
                  {showEditForm ? 'Hareketleri Göster' : 'Düzenle'}
                </button>
              )}
              {isAdmin && (selectedCari || showEditForm) && (
                <button 
                  onClick={resetForm}
                  className="text-xs px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-lg font-semibold transition cursor-pointer"
                >
                  Yeni Cari Ekle
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="py-24 flex justify-center items-center rounded-2xl glass">
              <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : caris.length === 0 ? (
            <div className="text-center py-24 text-gray-500 text-sm rounded-2xl glass">
              Henüz kayıtlı cari hesap yok. {isAdmin ? 'Sağdaki formu kullanarak ekleyin.' : 'Lütfen yöneticinizin eklemesini bekleyin.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto pr-2">
              {caris.map((c) => {
                const isSelected = selectedCari?.id === c.id
                return (
                  <div
                    key={c.id}
                    onClick={() => handleSelectCari(c)}
                    className={`p-5 rounded-2xl cursor-pointer text-left transition-all border ${
                      isSelected
                        ? 'bg-[#1b1406] border-amber-500 glow-amber shadow-lg'
                        : 'glass-card border-amber-500/10 hover:border-amber-500/20'
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
                        {c.notes && (
                          <p className="text-xs text-gray-400 flex items-center gap-1.5 mt-1">
                            <StickyNote className="w-3.5 h-3.5" />
                            <span className="truncate max-w-[150px]">{c.notes}</span>
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
                          title="Cariyi Sil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-amber-500/5 text-xs">
                      <div>
                        <span className="text-[10px] text-gray-500 block uppercase font-bold tracking-wider">Başlangıç Borcu</span>
                        <span className="font-semibold text-white">
                          {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(c.startingBalance)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 block uppercase font-bold tracking-wider">Kalan Borcumuz</span>
                        <span className={`font-black ${c.currentBalance > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(c.currentBalance)}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right Column: Profile Form & Make Payment / History */}
        <div className="space-y-6">
          {(showEditForm || caris.length === 0) ? (
            // Main Cari profile form (Only Admin can create/edit profiles)
            isAdmin ? (
              <div className="p-6 rounded-2xl glass-card space-y-4">
                <h3 className="font-bold text-lg text-white flex items-center gap-2 pb-2 border-b border-amber-500/10">
                  <Edit3 className="w-5 h-5 text-amber-400" />
                  <span>{isEditing ? 'Cari Profili Düzenle' : 'Yeni Cari Profil Ekle'}</span>
                </h3>

                <form onSubmit={handleSubmit} className="space-y-4 text-left">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Firma / Cari Adı</label>
                    <input
                      type="text"
                      required
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Örn: Set Işık Kiralama A.Ş."
                      className="w-full text-sm px-4 py-2.5 rounded-xl bg-violet-950/20 border border-violet-500/10 text-white focus:outline-none focus:border-violet-500 transition"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Telefon</label>
                    <input
                      type="text"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="0212..."
                      className="w-full text-sm px-4 py-2.5 rounded-xl bg-violet-950/20 border border-violet-500/10 text-white focus:outline-none focus:border-violet-500 transition"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Notlar / Adres</label>
                    <textarea
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      placeholder="Banka bilgileri, adres, fatura detayları..."
                      rows={2}
                      className="w-full text-sm px-4 py-2.5 rounded-xl bg-violet-950/20 border border-violet-500/10 text-white focus:outline-none focus:border-violet-500 transition resize-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Başlangıç Borç Bakiyesi (₺)</label>
                    <input
                      type="number"
                      value={form.startingBalance}
                      disabled={isEditing}
                      onChange={(e) => setForm({ ...form, startingBalance: e.target.value })}
                      placeholder="0.00"
                      className="w-full text-sm px-4 py-2.5 rounded-xl bg-violet-950/20 border border-violet-500/10 disabled:opacity-50 text-white focus:outline-none focus:border-violet-500 transition"
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    {isEditing && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowEditForm(false)
                          setIsEditing(false)
                        }}
                        className="flex-1 py-2.5 border border-amber-500/20 hover:bg-amber-950/20 text-gray-300 text-sm font-semibold rounded-xl transition cursor-pointer"
                      >
                        Vazgeç
                      </button>
                    )}
                    <button
                      type="submit"
                      className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      <span>{isEditing ? 'Güncelle' : 'Cari Kaydet'}</span>
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="p-6 rounded-2xl glass-card text-center text-gray-400 text-sm">
                Cari profil ekleme ve düzenleme yetkisi sadece **Yöneticilerdedir**.
              </div>
            )
          ) : selectedCari ? (
            // Cari Transaction History (Bu Ay)
            <div className="p-6 rounded-2xl glass-card space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-amber-500/10">
                <h3 className="font-bold text-base text-white flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-amber-400" />
                  <span className="truncate max-w-[150px]">{selectedCari.name} - Hareketler</span>
                </h3>
                {(() => {
                  const now = new Date()
                  const monthRecords = financeRecords.filter(r => {
                    if (r.cariId !== selectedCari.id) return false
                    const rDate = new Date(r.date)
                    return rDate.getFullYear() === now.getFullYear() && rDate.getMonth() === now.getMonth()
                  })
                  if (monthRecords.length === 0) return null
                  return (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => exportCariTransactionsToCSV(selectedCari, monthRecords)}
                        className="p-1.5 bg-[#1b1406] hover:bg-amber-950/20 text-amber-400 border border-amber-500/20 rounded-lg transition cursor-pointer"
                        title="Seçili Carinin Hareketlerini Excel Olarak İndir"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => window.print()}
                        className="p-1.5 bg-violet-950/20 border border-violet-500/10 text-gray-300 hover:text-white rounded-lg transition cursor-pointer"
                        title="Hareketleri Yazdır"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )
                })()}
              </div>
              
              {(() => {
                const now = new Date()
                const monthRecords = financeRecords.filter(r => {
                  if (r.cariId !== selectedCari.id) return false
                  const rDate = new Date(r.date)
                  return rDate.getFullYear() === now.getFullYear() && rDate.getMonth() === now.getMonth()
                })

                return monthRecords.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 text-sm">
                    Bu aya ait hareket geçmişi bulunmamaktadır.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-violet-500/10 glass max-h-[300px] overflow-y-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-violet-500/10 text-gray-500 uppercase font-bold tracking-wider bg-violet-950/10">
                          <th className="p-3">Tarih</th>
                          <th className="p-3">Açıklama</th>
                          <th className="p-3">Tür</th>
                          <th className="p-3 text-right">Tutar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthRecords.map(r => (
                          <tr key={r.id} className="border-b border-violet-500/5 hover:bg-violet-950/10 text-gray-300">
                            <td className="p-3 whitespace-nowrap">
                              {new Date(r.date).toLocaleDateString('tr-TR')}
                            </td>
                            <td className="p-3 truncate max-w-[120px]" title={r.description}>
                              {r.description || 'Açıklama yok'}
                            </td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                r.type === 'GELIR'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              }`}>
                                {r.type === 'GELIR' ? 'GELİR' : 'GİDER'}
                              </span>
                            </td>
                            <td className={`p-3 text-right font-bold ${
                              r.type === 'GELIR' ? 'text-emerald-400' : 'text-rose-400'
                            }`}>
                              {r.type === 'GELIR' ? '+' : '-'} {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(r.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              })()}
            </div>
          ) : (
            <div className="p-6 rounded-2xl glass-card text-center text-gray-400 text-sm">
              Soldan bir cari hesap seçerek hareket geçmişini ve ödeme panelini görüntüleyebilirsiniz.
            </div>
          )}

          {/* Quick Payment tool — Herkes yapabilir */}
          {selectedCari && !showEditForm && (
            <div className="p-6 rounded-2xl glass-card space-y-4 border border-rose-500/20">
              <h3 className="font-bold text-lg text-white flex items-center gap-2 pb-2 border-b border-rose-500/10">
                <DollarSign className="w-5 h-5 text-rose-400" />
                <span>Ödeme Yap (Borçtan Düş)</span>
              </h3>

              <div className="text-xs text-gray-400 text-left">
                Firma: <strong className="text-white">{selectedCari.name}</strong><br/>
                Kalan Borç: <strong className="text-rose-400 font-bold">
                  {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(selectedCari.currentBalance)}
                </strong>
              </div>

              <form onSubmit={handleMakePayment} className="space-y-3 text-left">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Ödenen Tutar (Kasadan Düşer)</label>
                  <input
                    type="number"
                    required
                    min="0.01"
                    step="0.01"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full text-sm px-4 py-2.5 rounded-xl bg-violet-950/20 border border-violet-500/10 text-white focus:outline-none focus:border-violet-500 transition"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold rounded-xl transition cursor-pointer"
                >
                  Ödemeyi Tamamla (Kalan Borçtan Düş)
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
