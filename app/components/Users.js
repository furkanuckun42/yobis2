'use client'

import { useState, useEffect } from 'react'
import { UserPlus, Trash2, Shield, User, Loader2, Pencil, X } from 'lucide-react'

export default function Users({ currentUser, addToast, showConfirm }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Ekleme/Düzenleme formu state'leri
  const [editingUser, setEditingUser] = useState(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState('personel')
  const [saving, setSaving] = useState(false)

  // Şifre Gösterme (Reveal) States
  const [revealModalOpen, setRevealModalOpen] = useState(false)
  const [adminPassword, setAdminPassword] = useState('')
  const [revealedPassword, setRevealedPassword] = useState('')
  const [revealError, setRevealError] = useState('')
  const [revealing, setRevealing] = useState(false)
  const [revealTargetUser, setRevealTargetUser] = useState(null)

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

  const handleEditUser = async (e) => {
    e.preventDefault()
    if (!username.trim()) {
      addToast('Lütfen kullanıcı adı girin!', 'warning')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/auth/users', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-requester-role': currentUser?.role || '',
          'x-requester-id': currentUser?.id || ''
        },
        body: JSON.stringify({
          id: editingUser.id,
          username,
          password: password.trim() ? password : undefined,
          role,
          displayName
        })
      })

      const data = await res.json()
      if (res.ok) {
        addToast('Kullanıcı başarıyla güncellendi!', 'success')
        setEditingUser(null)
        setUsername('')
        setPassword('')
        setDisplayName('')
        setRole('personel')
        fetchUsers()
      } else {
        addToast(data.error || 'Kullanıcı güncellenemedi.', 'error')
      }
    } catch (err) {
      console.error(err)
      addToast('Bağlantı hatası oluştu.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (user) => {
    setEditingUser(user)
    setUsername(user.username)
    setPassword('') // Şifre değiştirilmek istenmiyorsa boş kalır
    setDisplayName(user.displayName || '')
    setRole(user.role)
  }

  const cancelEdit = () => {
    setEditingUser(null)
    setUsername('')
    setPassword('')
    setDisplayName('')
    setRole('personel')
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
          if (editingUser?.id === targetId) {
            cancelEdit()
          }
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

  const handleRevealPassword = async (e) => {
    e.preventDefault()
    if (!adminPassword.trim()) {
      setRevealError('Lütfen şifrenizi girin!')
      return
    }

    setRevealing(true)
    setRevealError('')
    try {
      const res = await fetch('/api/auth/users/reveal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-requester-role': currentUser?.role || '',
          'x-requester-id': currentUser?.id || ''
        },
        body: JSON.stringify({
          targetUserId: revealTargetUser.id,
          adminPassword
        })
      })

      const data = await res.json()
      if (res.ok) {
        if (data.success) {
          setRevealedPassword(data.password)
        } else {
          setRevealError(data.message)
        }
      } else {
        setRevealError(data.error || 'Şifre çözülemedi.')
      }
    } catch (err) {
      console.error(err)
      setRevealError('Bağlantı hatası.')
    } finally {
      setRevealing(false)
    }
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
        <p className="text-gray-400 mt-1">Sistemdeki personelleri ve freelancerları yönetin, yetki ve erişim haklarını düzenleyin.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Kullanıcı Ekleme / Düzenleme Formu */}
        <div className="p-6 rounded-2xl glass-card space-y-4 h-fit">
          <h4 className="font-bold text-lg text-white flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-violet-400" />
            <span>{editingUser ? 'Kullanıcıyı Düzenle' : 'Yeni Kullanıcı Ekle'}</span>
          </h4>

          <form onSubmit={editingUser ? handleEditUser : handleAddUser} className="space-y-4">
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
              <label className="text-xs text-gray-400 block mb-1.5 font-medium">
                {editingUser ? 'Yeni Şifre (Değiştirmek istemiyorsanız boş bırakın)' : 'Şifre'}
              </label>
              <input
                type="password"
                required={!editingUser}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={editingUser ? "Yeni şifre belirleyin..." : "Şifre belirleyin..."}
                className="w-full text-sm px-3.5 py-2.5 rounded-xl bg-violet-950/20 border border-violet-500/10 text-white focus:outline-none focus:border-violet-500 transition"
              />
              {editingUser && (
                <button
                  type="button"
                  onClick={() => {
                    setRevealTargetUser(editingUser)
                    setRevealModalOpen(true)
                    setAdminPassword('')
                    setRevealedPassword('')
                    setRevealError('')
                  }}
                  className="mt-1.5 text-xs text-violet-400 hover:text-violet-300 font-bold underline cursor-pointer"
                >
                  Mevcut Şifreyi Göster
                </button>
              )}
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1.5 font-medium">Sistem Rolü / Yetki</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full text-sm px-3.5 py-2.5 rounded-xl bg-violet-950/20 border border-violet-500/10 text-white focus:outline-none focus:border-violet-500 transition cursor-pointer"
              >
                <option value="personel" className="bg-[#05020c] text-white">Personel (Kısıtlı Erişim)</option>
                <option value="freelancer" className="bg-[#05020c] text-white">Freelancer (Kısıtlı Görev Erişimi)</option>
                <option value="admin" className="bg-[#05020c] text-white">Yönetici (Tam Yetki)</option>
              </select>
            </div>

            <div className="space-y-2">
              <button
                type="submit"
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition cursor-pointer disabled:opacity-50 shadow-lg shadow-violet-600/10"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
                <span>{editingUser ? 'Değişiklikleri Kaydet' : 'Kullanıcıyı Kaydet'}</span>
              </button>

              {editingUser && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-violet-500/15 text-gray-300 hover:text-white hover:bg-violet-950/20 rounded-xl text-sm font-semibold cursor-pointer transition"
                >
                  Düzenlemeyi İptal Et
                </button>
              )}
            </div>
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
                  className={`p-4 rounded-xl border flex items-center justify-between group transition-all duration-200 ${
                    editingUser?.id === user.id 
                      ? 'border-violet-500 bg-violet-950/20 shadow-md shadow-violet-500/5' 
                      : 'border-violet-500/10 bg-violet-950/10 hover:border-violet-500/20'
                  }`}
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
                        : user.role === 'freelancer'
                          ? 'border-amber-500/20 text-amber-400 bg-amber-950/10'
                          : 'border-violet-500/20 text-violet-400 bg-violet-950/10'
                    }`}>
                      {user.role === 'admin' ? 'Yönetici' : user.role === 'freelancer' ? 'Freelancer' : 'Personel'}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => startEdit(user)}
                        className="p-2 rounded-lg border border-violet-500/20 hover:border-violet-500/40 bg-violet-950/10 hover:bg-violet-950/30 text-violet-400 transition opacity-80 group-hover:opacity-100 cursor-pointer"
                        title="Kullanıcıyı Düzenle"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>

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
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Şifre Gösterme Doğrulama Modali */}
      {revealModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md p-6 rounded-2xl glass-card border border-violet-500/15 space-y-4 text-center shadow-2xl relative">
            <button
              onClick={() => {
                setRevealModalOpen(false)
                setRevealedPassword('')
                setAdminPassword('')
                setRevealError('')
              }}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-violet-950/40 text-gray-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="font-bold text-lg text-white">Güvenlik Doğrulaması</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              <strong>@{revealTargetUser?.username}</strong> kullanıcısının şifresini görmek için kendi yönetici şifrenizi girmeniz gerekmektedir.
            </p>

            {revealedPassword ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-violet-950/30 border border-violet-500/20 text-center">
                  <span className="text-[10px] text-gray-400 block mb-1 uppercase tracking-wider">Kullanıcı Şifresi</span>
                  <span className="text-xl font-bold text-emerald-400 font-mono tracking-wider select-all block py-1">
                    {revealedPassword}
                  </span>
                </div>
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(revealedPassword)
                      addToast('Şifre panoya kopyalandı.', 'success')
                    }}
                    className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    Kopyala
                  </button>
                  <button
                    onClick={() => {
                      setRevealModalOpen(false)
                      setRevealedPassword('')
                      setAdminPassword('')
                      setRevealError('')
                    }}
                    className="px-4 py-2 border border-violet-500/20 hover:bg-violet-950/20 text-gray-300 text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    Kapat
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleRevealPassword} className="space-y-4 text-left">
                {revealError && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-xs font-semibold">
                    {revealError}
                  </div>
                )}
                <div>
                  <label className="text-xs text-gray-400 block mb-1.5 font-medium">Yönetici Şifreniz</label>
                  <input
                    type="password"
                    required
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Şifrenizi girin..."
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl bg-violet-950/20 border border-violet-500/10 text-white focus:outline-none focus:border-violet-500 transition"
                  />
                </div>
                <button
                  type="submit"
                  disabled={revealing}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition cursor-pointer disabled:opacity-50"
                >
                  {revealing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  <span>Doğrula ve Şifreyi Göster</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
