'use client'

import { useState, useEffect } from 'react'
import { UserPlus, Trash2, Shield, User, Loader2 } from 'lucide-react'

export default function Users({ currentUser, addToast, showConfirm }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Ekleme formu state'leri
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState('personel')
  const [saving, setSaving] = useState(false)

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/auth/users', {
        headers: {
          'x-requester-role': currentUser?.role || '',
          'x-requester-id': currentUser?.id || ''
        }
      })
      if (res.ok) {
        const data = await res.json()
        setUsers(data)
      } else {
        console.error('Kullanıcılar alınamadı.')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleAddUser = async (e) => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) {
      addToast('Lütfen kullanıcı adı ve şifre girin!', 'warning')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/auth/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-requester-role': currentUser?.role || '',
          'x-requester-id': currentUser?.id || ''
        },
        body: JSON.stringify({ username, password, role, displayName })
      })

      const data = await res.json()
      if (res.ok) {
        addToast('Kullanıcı başarıyla eklendi!', 'success')
        setUsername('')
        setPassword('')
        setDisplayName('')
        setRole('personel')
        fetchUsers()
      } else {
        addToast(data.error || 'Kullanıcı eklenemedi.', 'error')
      }
    } catch (err) {
      console.error(err)
      addToast('Bağlantı hatası oluştu.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteUser = (targetId, targetUsername) => {
    if (targetId === currentUser?.id) {
      addToast('Kendi hesabınızı silemezsiniz!', 'warning')
      return
    }

    showConfirm(`${targetUsername} kullanıcısını silmek istediğinize emin misiniz?`, async () => {
      try {
        const res = await fetch(`/api/auth/users?id=${targetId}`, {
          method: 'DELETE',
          headers: {
            'x-requester-role': currentUser?.role || '',
            'x-requester-id': currentUser?.id || ''
          }
        })

        const data = await res.json()
        if (res.ok) {
          addToast('Kullanıcı başarıyla silindi!', 'success')
          fetchUsers()
        } else {
          addToast(data.error || 'Kullanıcı silinemedi.', 'error')
        }
      } catch (err) {
        console.error(err)
        addToast('Silme işlemi başarısız.', 'error')
      }
    })
  }

  if (currentUser?.role !== 'admin') {
    return (
      <div className="p-6 text-center text-rose-400 font-semibold glass-card rounded-2xl">
        Bu sayfayı görüntülemek için yetkiniz bulunmamaktadır. Sadece yöneticiler erişebilir.
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-fade-in text-left">
      <div>
        <h2 className="text-3xl font-extrabold tracking-tight glow-text text-white">Kullanıcı Yönetimi</h2>
        <p className="text-gray-400 mt-1">Sistemdeki personelleri yönetin, yetki ve erişim haklarını düzenleyin.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Yeni Kullanıcı Ekleme Formu */}
        <div className="p-6 rounded-2xl glass-card space-y-4 h-fit">
          <h4 className="font-bold text-lg text-white flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-violet-400" />
            <span>Yeni Kullanıcı Ekle</span>
          </h4>

          <form onSubmit={handleAddUser} className="space-y-4">
            <div>
              <label className="text-xs text-gray-400 block mb-1.5 font-medium">Ad Soyad</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Örn: Ahmet Yılmaz"
                className="w-full text-sm px-3.5 py-2.5 rounded-xl bg-violet-950/20 border border-violet-500/10 text-white focus:outline-none focus:border-violet-500 transition"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1.5 font-medium">Kullanıcı Adı</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="kullanici_adi..."
                className="w-full text-sm px-3.5 py-2.5 rounded-xl bg-violet-950/20 border border-violet-500/10 text-white focus:outline-none focus:border-violet-500 transition"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1.5 font-medium">Şifre</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Şifre belirleyin..."
                className="w-full text-sm px-3.5 py-2.5 rounded-xl bg-violet-950/20 border border-violet-500/10 text-white focus:outline-none focus:border-violet-500 transition"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1.5 font-medium">Sistem Rolü / Yetki</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full text-sm px-3.5 py-2.5 rounded-xl bg-violet-950/20 border border-violet-500/10 text-white focus:outline-none focus:border-violet-500 transition cursor-pointer"
              >
                <option value="personel" className="bg-[#05020c] text-white">Personel (Kısıtlı Erişim)</option>
                <option value="admin" className="bg-[#05020c] text-white">Yönetici (Tam Yetki)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
              <span>Kullanıcıyı Kaydet</span>
            </button>
          </form>
        </div>

        {/* Kullanıcı Listesi */}
        <div className="p-6 rounded-2xl glass-card lg:col-span-2 space-y-4">
          <h4 className="font-bold text-lg text-white flex items-center gap-2">
            <User className="w-5 h-5 text-violet-400" />
            <span>Kayıtlı Kullanıcılar</span>
          </h4>

          {loading ? (
            <div className="py-12 flex justify-center items-center">
              <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm">
              Kayıtlı kullanıcı bulunamadı.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="p-4 rounded-xl border border-violet-500/10 bg-violet-950/10 flex items-center justify-between group hover:border-violet-500/20 transition-all duration-200"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-violet-500/10 rounded-lg text-violet-400">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-semibold text-white text-sm block">
                        {user.displayName || user.username}
                      </span>
                      <span className="text-[10px] text-gray-500 block">@{user.username}</span>
                      <span className="text-[10px] text-gray-400 block mt-0.5">
                        Kayıt: {new Date(user.createdAt).toLocaleDateString('tr-TR')}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                      user.role === 'admin' 
                        ? 'border-emerald-500/20 text-emerald-400 bg-emerald-950/10' 
                        : 'border-violet-500/20 text-violet-400 bg-violet-950/10'
                    }`}>
                      {user.role === 'admin' ? 'Yönetici' : 'Personel'}
                    </span>

                    {user.id !== currentUser?.id && (
                      <button
                        onClick={() => handleDeleteUser(user.id, user.username)}
                        className="p-2 rounded-lg border border-rose-500/20 hover:border-rose-500/40 bg-rose-950/10 hover:bg-rose-950/30 text-rose-400 transition opacity-80 group-hover:opacity-100 cursor-pointer"
                        title="Kullanıcıyı Sil"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
