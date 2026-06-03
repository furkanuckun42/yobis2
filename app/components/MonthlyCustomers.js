'use client'

import { useState, useEffect } from 'react'
import {
  Plus,
  Trash2,
  Calendar,
  User,
  CheckCircle2,
  Clock,
  Archive,
  CreditCard,
  Building2,
  TrendingUp,
  Loader2,
  Check,
  X,
  Pencil,
  Download,
  Printer
} from 'lucide-react'

// Yerel saat dilimine göre YYYY-MM-DD formatında tarih üretir (timezone-safe)
const getLocalDateString = (date = new Date()) => {
  const offset = date.getTimezoneOffset()
  const localDate = new Date(date.getTime() - (offset * 60 * 1000))
  return localDate.toISOString().split('T')[0]
}

// Yerel saat dilimine göre YYYY-MM formatında ay üretir (timezone-safe)
const getLocalMonthString = (date = new Date()) => {
  const offset = date.getTimezoneOffset()
  const localDate = new Date(date.getTime() - (offset * 60 * 1000))
  return localDate.toISOString().substring(0, 7)
}

export default function MonthlyCustomers({ currentUser, addToast, showConfirm }) {
  const [cards, setCards] = useState([])
  const [customers, setCustomers] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Filtering & Selected Month
  const [selectedMonth, setSelectedMonth] = useState(() => {
    return getLocalMonthString()
  })

  // Modal State for New Card
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [creatingCard, setCreatingCard] = useState(false)

  // Card Item Creation States (indexed by cardId to support inline item creation per card)
  const [newItems, setNewItems] = useState({})

  // Inline Edit Item Title States
  const [editingItemId, setEditingItemId] = useState(null)
  const [editingItemTitle, setEditingItemTitle] = useState('')

  // Fetch Data
  const fetchData = async () => {
    setLoading(true)
    try {
      const headers = {
        'x-requester-id': currentUser?.id || '',
        'x-requester-role': currentUser?.role || '',
        'x-requester-username': currentUser?.username || ''
      }

      // 1. Fetch Monthly Cards
      const cardsRes = await fetch(`/api/admin/monthly-cards?month=${selectedMonth}&includeArchived=true`, { headers })
      const cardsData = await cardsRes.json()
      
      // 2. Fetch Customers
      const customersRes = await fetch('/api/customers', { headers })
      const customersData = await customersRes.json()

      // 3. Fetch Users for Task Assignment
      const usersRes = await fetch('/api/auth/users', { headers })
      const usersData = await usersRes.json()

      if (cardsRes.ok && customersRes.ok && usersRes.ok) {
        setCards(cardsData)
        setCustomers(customersData)
        setUsers(usersData)
      } else {
        addToast('Veriler yüklenirken bir hata oluştu.', 'error')
      }
    } catch (err) {
      console.error(err)
      addToast('Sunucu bağlantı hatası.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (currentUser?.role === 'admin') {
      fetchData()
    }
  }, [selectedMonth])

  if (currentUser?.role !== 'admin') {
    return (
      <div className="p-8 rounded-2xl glass border border-rose-500/20 text-center space-y-4 max-w-xl mx-auto my-12">
        <X className="w-12 h-12 text-rose-500 mx-auto animate-pulse" />
        <h3 className="text-xl font-bold text-white">Erişim Engellendi</h3>
        <p className="text-sm text-gray-400">
          Bu sayfayı görüntülemek için yönetici (admin) yetkilerine sahip olmanız gerekmektedir.
        </p>
      </div>
    )
  }

  // Create New Card
  const handleCreateCard = async (e) => {
    e.preventDefault()
    if (!selectedCustomerId) {
      addToast('Lütfen bir müşteri seçin.', 'warning')
      return
    }

    setCreatingCard(true)
    try {
      const res = await fetch('/api/admin/monthly-cards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-requester-role': currentUser?.role || '',
          'x-requester-username': currentUser?.username || ''
        },
        body: JSON.stringify({
          customerId: selectedCustomerId,
          month: selectedMonth
        })
      })

      const data = await res.json()
      if (res.ok) {
        addToast('Müşteri aylık takip kartı başarıyla oluşturuldu.', 'success')
        setIsModalOpen(false)
        setSelectedCustomerId('')
        fetchData()
      } else {
        addToast(data.error || 'Kart oluşturulamadı.', 'error')
      }
    } catch (err) {
      console.error(err)
      addToast('Bağlantı hatası oluştu.', 'error')
    } finally {
      setCreatingCard(false)
    }
  }

  // Delete Card (Optionally added to clean mistakes)
  const handleDeleteCard = async (cardId) => {
    showConfirm('Bu aylık takip kartını silmek istediğinizden emin misiniz? Kart içindeki tüm maddeler ve ilişkili görevler silinecektir.', async () => {
      try {
        // We can reuse a DELETE endpoint or update status to ARCHIVED.
        // Let's implement card deletion if needed, but since users might make mistake, let's allow it via a delete API
        // For simplicity, we will update status to 'ARCHIVED' or delete it. Let's delete it if they want.
        // Since we don't have a direct Card DELETE endpoint, we can update status to 'ARCHIVED' or if they want full delete:
        // Let's implement DELETE inside monthly-cards/route.js or just update status to ARCHIVED.
        // The requirement is: "ödeme alındı dediğimde de arşive at kartı".
        // Let's just handle it. We can add a simple Card DELETE support:
        const res = await fetch(`/api/admin/monthly-cards?id=${cardId}`, {
          method: 'DELETE',
          headers: {
            'x-requester-role': currentUser?.role || ''
          }
        })
        // Wait! We didn't define DELETE in route.js yet. Let's define it or just use PUT status: 'ARCHIVED'
        // If we don't have DELETE, let's call DELETE to `/api/admin/monthly-cards?id=${cardId}`. We will add DELETE method in route.js next!
        if (res.ok) {
          addToast('Kart başarıyla silindi.', 'success')
          fetchData()
        } else {
          const err = await res.json()
          addToast(err.error || 'Silme işlemi başarısız.', 'error')
        }
      } catch (err) {
        console.error(err)
      }
    })
  }

  // Handle Mark Payment Received
  const handlePaymentReceived = async (card) => {
    showConfirm(`${card.customer.name} müşterisinden ${card.month} dönemine ait aylık hizmet bedeli olan ${new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(card.customer.monthlyIncome)} ödemesinin alındığını onaylıyor musunuz? Bu işlem ödemeyi kasaya gelir olarak işleyecek ve kartı arşivleyecektir.`, async () => {
      try {
        const res = await fetch('/api/admin/monthly-cards', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-requester-role': currentUser?.role || '',
            'x-requester-username': currentUser?.username || ''
          },
          body: JSON.stringify({
            cardId: card.id,
            status: 'ARCHIVED'
          })
        })

        const data = await res.json()
        if (res.ok) {
          addToast('Ödeme alındı olarak işaretlendi ve kasaya işlendi.', 'success')
          fetchData()
        } else {
          addToast(data.error || 'İşlem başarısız.', 'error')
        }
      } catch (err) {
        console.error(err)
        addToast('Bağlantı hatası.', 'error')
      }
    })
  }

  // Add Item to Card
  const handleAddItem = async (cardId) => {
    const itemState = newItems[cardId] || {}
    const title = itemState.title?.trim()
    const assignedUserId = itemState.assignedUserId || ''
    const dueDate = itemState.dueDate || ''

    if (!title) {
      addToast('Lütfen yapılacak madde başlığını girin.', 'warning')
      return
    }

    try {
      const res = await fetch('/api/admin/monthly-cards/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-requester-role': currentUser?.role || '',
          'x-requester-username': currentUser?.username || ''
        },
        body: JSON.stringify({
          cardId,
          title,
          assignedUserId,
          dueDate
        })
      })

      const data = await res.json()
      if (res.ok) {
        addToast('Maddeler ve ilişkili görev oluşturuldu.', 'success')
        // Reset inputs for this card
        setNewItems(prev => ({
          ...prev,
          [cardId]: { title: '', assignedUserId: '', dueDate: '' }
        }))
        fetchData()
      } else {
        addToast(data.error || 'Madde eklenemedi.', 'error')
      }
    } catch (err) {
      console.error(err)
      addToast('Bağlantı hatası.', 'error')
    }
  }

  // Toggle Checklist Item State
  const handleToggleItem = async (item, completed) => {
    try {
      const res = await fetch('/api/admin/monthly-cards/items', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-requester-role': currentUser?.role || '',
          'x-requester-username': currentUser?.username || ''
        },
        body: JSON.stringify({
          itemId: item.id,
          completed: completed
        })
      })

      const data = await res.json()
      if (res.ok) {
        addToast(completed ? 'Madde tamamlandı.' : 'Madde tamamlanmadı olarak işaretlendi.', 'info')
        fetchData()
      } else {
        addToast(data.error || 'İşlem başarısız.', 'error')
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Delete Item from Card
  const handleDeleteItem = async (itemId) => {
    try {
      const res = await fetch(`/api/admin/monthly-cards/items?id=${itemId}`, {
        method: 'DELETE',
        headers: {
          'x-requester-role': currentUser?.role || '',
          'x-requester-username': currentUser?.username || ''
        }
      })
      if (res.ok) {
        addToast('Madde ve ilişkili görev silindi.', 'success')
        fetchData()
      } else {
        const err = await res.json()
        addToast(err.error || 'Madde silinemedi.', 'error')
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Update checklist item date inline
  const handleUpdateItemDate = async (itemId, dueDate) => {
    try {
      const res = await fetch('/api/admin/monthly-cards/items', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-requester-role': currentUser?.role || '',
          'x-requester-username': currentUser?.username || ''
        },
        body: JSON.stringify({
          itemId,
          dueDate: dueDate || null
        })
      })
      const data = await res.json()
      if (res.ok) {
        addToast('Teslim tarihi güncellendi.', 'success')
        fetchData()
      } else {
        addToast(data.error || 'Tarih güncellenemedi.', 'error')
      }
    } catch (err) {
      console.error(err)
      addToast('Bağlantı hatası.', 'error')
    }
  }

  // Update checklist item assignee inline
  const handleUpdateItemAssignee = async (itemId, assignedUserId) => {
    try {
      const res = await fetch('/api/admin/monthly-cards/items', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-requester-role': currentUser?.role || '',
          'x-requester-username': currentUser?.username || ''
        },
        body: JSON.stringify({
          itemId,
          assignedUserId: assignedUserId || null
        })
      })
      const data = await res.json()
      if (res.ok) {
        addToast('Atanan kişi güncellendi.', 'success')
        fetchData()
      } else {
        addToast(data.error || 'Atama güncellenemedi.', 'error')
      }
    } catch (err) {
      console.error(err)
      addToast('Bağlantı hatası.', 'error')
    }
  }

  // Update checklist item title inline
  const handleSaveItemTitle = async (itemId) => {
    if (!editingItemTitle.trim()) {
      addToast('Lütfen başlık girin.', 'warning')
      return
    }
    try {
      const res = await fetch('/api/admin/monthly-cards/items', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-requester-role': currentUser?.role || '',
          'x-requester-username': currentUser?.username || ''
        },
        body: JSON.stringify({
          itemId,
          title: editingItemTitle
        })
      })
      const data = await res.json()
      if (res.ok) {
        addToast('Başlık güncellendi.', 'success')
        setEditingItemId(null)
        fetchData()
      } else {
        addToast(data.error || 'Başlık güncellenemedi.', 'error')
      }
    } catch (err) {
      console.error(err)
      addToast('Bağlantı hatası.', 'error')
    }
  }

  // Check Card Items Completion Status
  const getCardStatus = (card) => {
    if (card.status === 'ARCHIVED') return 'ARCHIVED'
    const totalItems = card.items.length
    if (totalItems === 0) return 'ACTIVE' // No items yet
    const completedItems = card.items.filter(item => item.completed).length
    return totalItems === completedItems ? 'COMPLETED' : 'ACTIVE'
  }

  // Group Cards for Trello columns
  const activeCards = cards.filter(card => getCardStatus(card) === 'ACTIVE')
  const completedCards = cards.filter(card => getCardStatus(card) === 'COMPLETED')
  const archivedCards = cards.filter(card => getCardStatus(card) === 'ARCHIVED')

  const exportCardsToCSV = () => {
    const headers = ['Müşteri Adı', 'Aylık Hizmet Bedeli', 'Kart Durumu', 'Yapılacak İşler / Tamamlanma Durumları']
    const rows = cards.map(c => {
      const cardStatus = getCardStatus(c)
      const statusText = cardStatus === 'ARCHIVED' ? 'Ödendi/Arşiv' : cardStatus === 'COMPLETED' ? 'Tamamlandı/Ödeme Bekliyor' : 'Devam Ediyor'
      const itemsText = c.items.map(item => `[${item.completed ? 'x' : ' '}] ${item.title} (${item.task?.assignedUser ? (item.task.assignedUser.displayName || item.task.assignedUser.username) : 'Atanmamış'})`).join(' | ')
      return [
        c.customer.name,
        c.customer.monthlyIncome.toString(),
        statusText,
        itemsText
      ]
    })
    const csvContent = "\uFEFF" + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `aylik_takip_${selectedMonth}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight glow-text text-white">Aylık Müşteriler</h2>
          <p className="text-gray-400 mt-1">Aylık bazda müşterilere sunulacak ürünlerin takibini yapın.</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Month Picker */}
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="text-sm px-4 py-2 rounded-xl bg-violet-950/20 border border-violet-500/10 text-gray-300 focus:outline-none focus:border-violet-500 transition cursor-pointer min-h-[38px]"
          />

          {cards.length > 0 && (
            <>
              {/* Excel İndir */}
              <button
                onClick={exportCardsToCSV}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#1b1406] hover:bg-amber-950/20 text-amber-400 border border-amber-500/20 text-xs font-semibold rounded-xl transition cursor-pointer min-h-[38px]"
                title="Aylık Kart Listesini Excel Olarak İndir"
              >
                <Download className="w-4 h-4" />
                <span>Excel</span>
              </button>
              
              {/* Yazdır */}
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-2 bg-violet-950/20 border border-violet-500/10 text-gray-300 hover:text-white text-xs font-semibold rounded-xl transition cursor-pointer min-h-[38px]"
                title="Listeyi Yazdır"
              >
                <Printer className="w-4 h-4" />
                <span>Yazdır</span>
              </button>
            </>
          )}

          <div className="relative">
            <button
              onClick={() => setIsModalOpen(!isModalOpen)}
              className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-xl transition cursor-pointer shadow-lg shadow-violet-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>Aylık Kart Oluştur</span>
            </button>

            {isModalOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 p-5 rounded-2xl glass border border-violet-500/20 shadow-2xl space-y-4 animate-scale-in z-50 text-left">
                <div className="flex justify-between items-center border-b border-violet-500/10 pb-2">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-violet-400" />
                    Aylık Kart Oluştur
                  </h3>
                  <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white transition">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleCreateCard} className="space-y-4">
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1 font-medium">Müşteri Seçin</label>
                    <select
                      required
                      value={selectedCustomerId}
                      onChange={(e) => setSelectedCustomerId(e.target.value)}
                      className="w-full text-xs px-3 py-2.5 rounded-xl bg-violet-950/20 border border-violet-500/10 text-white focus:outline-none focus:border-violet-500 transition"
                    >
                      <option value="" className="bg-[#05020c] text-white">Seçiniz...</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id} className="bg-[#05020c] text-white">
                          {c.name} ({new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(c.monthlyIncome)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1 font-medium">Dönem / Ay</label>
                    <input
                      type="month"
                      disabled
                      value={selectedMonth}
                      className="w-full text-xs px-3 py-2.5 rounded-xl bg-violet-950/40 border border-violet-500/5 text-gray-400 focus:outline-none"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-violet-500/10">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-3 py-1.5 border border-violet-500/10 text-gray-300 hover:text-white rounded-lg text-[10px] font-semibold cursor-pointer"
                    >
                      İptal
                    </button>
                    <button
                      type="submit"
                      disabled={creatingCard}
                      className="flex items-center gap-1 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-[10px] font-semibold rounded-lg transition cursor-pointer disabled:opacity-50"
                    >
                      {creatingCard && <Loader2 className="w-3 h-3 animate-spin" />}
                      Oluştur
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
          <span className="text-xs text-gray-400 font-medium">Kartlar yükleniyor...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Column 1: Devam Edenler */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-violet-500/10 pb-3">
              <h3 className="text-sm font-extrabold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-violet-400" />
                Devam Edenler
              </h3>
              <span className="text-xs bg-violet-500/10 border border-violet-500/20 text-violet-400 px-2 py-0.5 rounded-full font-bold">
                {activeCards.length}
              </span>
            </div>
            
            <div className="space-y-4 min-h-[500px]">
              {activeCards.length === 0 ? (
                <div className="p-6 rounded-xl border border-dashed border-violet-500/10 text-center text-xs text-gray-500">
                  Devam eden aylık müşteri kartı bulunmamaktadır.
                </div>
              ) : (
                activeCards.map(card => renderCard(card))
              )}
            </div>
          </div>

          {/* Column 2: Tamamlananlar & Ödeme Bekleyenler */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-amber-500/10 pb-3">
              <h3 className="text-sm font-extrabold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-amber-400 animate-pulse" />
                Ödeme Bekleyenler
              </h3>
              <span className="text-xs bg-amber-500/10 border border-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-bold">
                {completedCards.length}
              </span>
            </div>

            <div className="space-y-4 min-h-[500px]">
              {completedCards.length === 0 ? (
                <div className="p-6 rounded-xl border border-dashed border-amber-500/10 text-center text-xs text-gray-500">
                  Tüm maddeleri tamamlanıp ödeme bekleyen kart bulunmamaktadır.
                </div>
              ) : (
                completedCards.map(card => renderCard(card))
              )}
            </div>
          </div>

          {/* Column 3: Arşivlenenler (Paid / Archived) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-emerald-500/10 pb-3">
              <h3 className="text-sm font-extrabold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Ödenenler & Arşiv
              </h3>
              <span className="text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                {archivedCards.length}
              </span>
            </div>

            <div className="space-y-4 min-h-[500px]">
              {archivedCards.length === 0 ? (
                <div className="p-6 rounded-xl border border-dashed border-emerald-500/10 text-center text-xs text-gray-500">
                  Arşivlenmiş veya ödenmiş kart bulunmamaktadır.
                </div>
              ) : (
                archivedCards.map(card => renderCard(card))
              )}
            </div>
          </div>
        </div>
      )}


    </div>
  )

  // Inner Card Renderer
  function renderCard(card) {
    const cardStatus = getCardStatus(card)
    const isCompleted = cardStatus === 'COMPLETED'
    const isArchived = cardStatus === 'ARCHIVED'
    const totalItems = card.items.length
    const completedCount = card.items.filter(i => i.completed).length

    // State bindings for this card's new checklist item
    const itemState = newItems[card.id] || { title: '', assignedUserId: '', dueDate: '' }
    const setItemState = (fields) => {
      setNewItems(prev => ({
        ...prev,
        [card.id]: { ...(prev[card.id] || { title: '', assignedUserId: '', dueDate: '' }), ...fields }
      }))
    }

    return (
      <div key={card.id} className="p-5 rounded-2xl glass border border-violet-500/10 hover:border-violet-500/20 transition-all flex flex-col justify-between space-y-4 shadow-lg group relative">
        <button
          onClick={() => handleDeleteCard(card.id)}
          className="absolute top-4 right-4 p-1 text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition opacity-0 group-hover:opacity-100 cursor-pointer"
          title="Takip Kartını Sil"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white text-base tracking-wide">{card.customer.name}</span>
            {isArchived ? (
              <span className="text-[9px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold">Ödendi</span>
            ) : isCompleted ? (
              <span className="text-[9px] bg-amber-500/10 border border-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-bold animate-pulse">Tamamlandı</span>
            ) : null}
          </div>
          
          <div className="flex items-center gap-1.5 text-xs text-violet-400 font-semibold">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(card.customer.monthlyIncome)} / Ay</span>
          </div>
        </div>

        {/* Checklist Items */}
        <div className="space-y-2">
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Aylık Ürün / İş Takibi</p>
          
          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {card.items.length === 0 ? (
              <p className="text-xs text-gray-500 italic">Eklenecek madde bulunmuyor.</p>
            ) : (
              card.items.map(item => (
                <div key={item.id} className="flex items-center justify-between group/item p-1.5 rounded-lg hover:bg-violet-950/10 transition">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <button
                      disabled={isArchived}
                      onClick={() => handleToggleItem(item, !item.completed)}
                      className={`p-0.5 rounded border transition cursor-pointer flex-shrink-0 ${
                        item.completed
                          ? 'border-emerald-500 bg-emerald-500/15 text-emerald-400'
                          : 'border-violet-500/25 hover:border-violet-500 text-transparent'
                      }`}
                    >
                      <Check className="w-3 h-3 stroke-[3]" />
                    </button>

                    {editingItemId === item.id ? (
                      <div className="flex items-center gap-1 flex-1 min-w-0">
                        <input
                          type="text"
                          value={editingItemTitle}
                          onChange={(e) => setEditingItemTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveItemTitle(item.id)
                            if (e.key === 'Escape') setEditingItemId(null)
                          }}
                          autoFocus
                          className="bg-violet-950/40 border border-violet-500/25 text-xs px-2 py-0.5 rounded text-white focus:outline-none focus:border-violet-500 flex-1 min-w-0"
                        />
                        <button
                          onClick={() => handleSaveItemTitle(item.id)}
                          className="p-0.5 text-emerald-400 hover:bg-emerald-500/10 rounded cursor-pointer flex-shrink-0"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingItemId(null)}
                          className="p-0.5 text-rose-400 hover:bg-rose-500/10 rounded cursor-pointer flex-shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span
                        onDoubleClick={() => {
                          if (!isArchived) {
                            setEditingItemId(item.id)
                            setEditingItemTitle(item.title)
                          }
                        }}
                        className={`text-xs truncate ${item.completed ? 'text-gray-500 line-through' : 'text-gray-300'} ${!isArchived ? 'cursor-pointer hover:text-white' : ''}`}
                        title={item.title}
                      >
                        {item.title}
                      </span>
                    )}
                  </div>

                  {/* Assignee & Due Date Indicators */}
                  <div className="flex items-center gap-1.5 flex-shrink-0 pl-2">
                    {isArchived ? (
                      <>
                        {item.task?.assignedUser && (
                          <span
                            className="w-5 h-5 rounded-full bg-violet-600/35 border border-violet-500/20 text-[9px] font-bold text-violet-300 flex items-center justify-center uppercase"
                            title={`Atanan Kişi: ${item.task.assignedUser.displayName || item.task.assignedUser.username}`}
                          >
                            {(item.task.assignedUser.displayName || item.task.assignedUser.username).substring(0, 2)}
                          </span>
                        )}

                        {item.task?.dueDate && (
                          <span 
                            className="text-[9px] px-1.5 py-0.5 rounded border font-semibold flex items-center gap-1 border-gray-500/25 text-gray-500 bg-gray-500/5"
                            title={`Teslim Tarihi: ${new Date(item.task.dueDate).toLocaleDateString('tr-TR')}`}
                          >
                            <Calendar className="w-2.5 h-2.5" />
                            {new Date(item.task.dueDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                          </span>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        {/* Inline Assignee Selection */}
                        <div className="relative flex items-center bg-violet-950/20 border border-violet-500/10 rounded px-1.5 py-0.5 hover:border-violet-500/30 transition">
                          <User className="w-3 h-3 text-violet-400 mr-0.5 pointer-events-none" />
                          <select
                            value={item.task?.assignedUserId || ''}
                            onChange={(e) => handleUpdateItemAssignee(item.id, e.target.value)}
                            className="bg-transparent border-none text-[9px] text-violet-300 focus:outline-none cursor-pointer font-bold p-0 max-w-[65px] h-4"
                            title="Atanan Kişi"
                          >
                            <option value="" className="bg-[#05020c] text-white">Ata...</option>
                            {users.map(u => (
                              <option key={u.id} value={u.id} className="bg-[#05020c] text-white">
                                {u.displayName || u.username}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Inline Due Date Picker */}
                        <div className="relative flex items-center bg-violet-950/20 border border-violet-500/10 rounded px-1 py-0.5 hover:border-violet-500/30 transition">
                          <Calendar className="w-3 h-3 text-violet-400 mr-0.5 pointer-events-none" />
                          <input
                            type="date"
                            value={item.task?.dueDate ? getLocalDateString(new Date(item.task.dueDate)) : ''}
                            onChange={(e) => handleUpdateItemDate(item.id, e.target.value)}
                            className="bg-transparent border-none text-[9px] text-violet-300 w-[74px] focus:outline-none cursor-pointer font-bold p-0 h-4"
                            title="Teslim Tarihi"
                          />
                        </div>

                        {/* Edit Title Button */}
                        {editingItemId !== item.id && (
                          <button
                            onClick={() => {
                              setEditingItemId(item.id)
                              setEditingItemTitle(item.title)
                            }}
                            className="text-gray-500 hover:text-violet-400 p-0.5 rounded transition cursor-pointer"
                            title="Başlığı Düzenle"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        )}

                        {/* Delete Item Button */}
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="text-gray-500 hover:text-rose-400 p-0.5 rounded transition cursor-pointer"
                          title="Maddeyi Sil"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Inline Add Item (Only for Active Cards) */}
        {!isArchived && (
          <div className="border-t border-violet-500/10 pt-3.5 space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Ne verilecek? (Ürün/İş)..."
                value={itemState.title || ''}
                onChange={(e) => setItemState({ title: e.target.value })}
                className="flex-1 text-xs px-3 py-2 rounded-xl bg-violet-950/20 border border-violet-500/10 text-white focus:outline-none focus:border-violet-500 transition"
              />
              
              <button
                onClick={() => handleAddItem(card.id)}
                className="p-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl cursor-pointer transition shadow-md shadow-violet-600/10"
                title="Ekle"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Inline Assignment and Due Date Pickers */}
            <div className="flex items-center gap-2">
              {/* Assignee Selection */}
              <div className="flex-1 relative flex items-center">
                <User className="absolute left-2.5 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                <select
                  value={itemState.assignedUserId || ''}
                  onChange={(e) => setItemState({ assignedUserId: e.target.value })}
                  className="w-full text-[10px] pl-7 pr-2 py-1.5 rounded-lg bg-violet-950/15 border border-violet-500/5 text-gray-400 focus:outline-none focus:border-violet-500/20 transition cursor-pointer"
                >
                  <option value="" className="bg-[#05020c] text-white">Kişi Ata...</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id} className="bg-[#05020c] text-white">
                      {u.displayName || u.username}
                    </option>
                  ))}
                </select>
              </div>

              {/* Due Date Picker */}
              <div className="flex-1 relative flex items-center">
                <Calendar className="absolute left-2.5 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                <input
                  type="date"
                  value={itemState.dueDate || ''}
                  onChange={(e) => setItemState({ dueDate: e.target.value })}
                  className="w-full text-[10px] pl-7 pr-2 py-1.5 rounded-lg bg-violet-950/15 border border-violet-500/5 text-gray-400 focus:outline-none focus:border-violet-500/20 transition cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        {/* Card Footer Actions */}
        <div className="border-t border-violet-500/10 pt-3">
          {isArchived ? (
            <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold py-1 justify-center bg-emerald-500/5 rounded-xl border border-emerald-500/10">
              <CheckCircle2 className="w-4 h-4" />
              Ödeme Alındı & Arşivlendi
            </div>
          ) : isCompleted ? (
            <div className="space-y-2">
              <div className="text-center text-xs font-extrabold text-amber-400 bg-amber-500/5 py-1.5 rounded-xl border border-amber-500/10 animate-pulse">
                ⚠️ Ödeme Bekleniyor
              </div>
              <button
                onClick={() => handlePaymentReceived(card)}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-lg shadow-emerald-600/20"
              >
                <CreditCard className="w-3.5 h-3.5" />
                Ödeme Alındı (Kasaya İşle)
              </button>
            </div>
          ) : (
            <div className="flex justify-between items-center text-[10px] text-gray-500 font-bold px-1">
              <span>Durum: Devam Ediyor</span>
              <span>{completedCount} / {totalItems} Tamamlandı</span>
            </div>
          )}
        </div>
      </div>
    )
  }
}
