'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, X, FolderKanban, Users, ShieldAlert, CheckSquare } from 'lucide-react'

export default function SearchModal({ isOpen, onClose, onNavigate }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState({ customers: [], projects: [], caris: [], tasks: [] })
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setQuery('')
      setResults({ customers: [], projects: [], caris: [], tasks: [] })
    }
  }, [isOpen])

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults({ customers: [], projects: [], caris: [], tasks: [] })
      return
    }

    const delayDebounce = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
        if (res.ok) {
          const data = await res.json()
          setResults(data)
        }
      } catch (err) {
        console.error('Arama hatası:', err)
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => clearTimeout(delayDebounce)
  }, [query])

  // ESC ile kapatma
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const hasResults = 
    results.customers.length > 0 ||
    results.projects.length > 0 ||
    results.caris.length > 0 ||
    results.tasks.length > 0

  const handleItemClick = (tab, id) => {
    onNavigate(tab, id)
    onClose()
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4 backdrop-blur-md bg-[#03000a]/70"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-xl rounded-2xl border border-violet-500/20 bg-[#0a0618]/95 shadow-[0_0_50px_rgba(139,92,246,0.15)] overflow-hidden animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Arama Girişi */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-violet-500/10">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Aramak istediğiniz kelimeyi yazın (örn: müşteri, proje, borç...)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-gray-200 outline-none placeholder:text-gray-500"
          />
          {loading ? (
            <div className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <button onClick={onClose} className="p-1 hover:bg-violet-950/40 rounded-lg text-gray-400 transition">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Sonuç Alanı */}
        <div className="max-h-[50vh] overflow-y-auto p-4 space-y-4">
          {query.trim().length < 2 ? (
            <div className="text-center py-8 text-xs text-gray-500">
              Arama yapmak için en az 2 karakter girin.
            </div>
          ) : !loading && !hasResults ? (
            <div className="text-center py-8 text-xs text-gray-500">
              Eşleşen sonuç bulunamadı.
            </div>
          ) : (
            <>
              {/* Müşteriler */}
              {results.customers.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-violet-400 mb-1.5 px-2 uppercase tracking-wider">
                    <Users className="w-3.5 h-3.5" />
                    <span>Müşteriler</span>
                  </div>
                  <div className="space-y-1">
                    {results.customers.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => handleItemClick('customers', c.id)}
                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-violet-950/20 border border-transparent hover:border-violet-500/10 text-xs text-gray-300 transition flex justify-between items-center"
                      >
                        <div>
                          <p className="font-semibold text-gray-200">{c.name}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{c.phone || 'Telefon yok'} • {c.instagram || 'Instagram yok'}</p>
                        </div>
                        <span className="text-[10px] text-emerald-400 font-mono">₺{c.currentBalance.toLocaleString('tr-TR')}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Projeler */}
              {results.projects.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-violet-400 mb-1.5 px-2 uppercase tracking-wider">
                    <FolderKanban className="w-3.5 h-3.5" />
                    <span>Projeler</span>
                  </div>
                  <div className="space-y-1">
                    {results.projects.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => handleItemClick('projects', p.id)}
                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-violet-950/20 border border-transparent hover:border-violet-500/10 text-xs text-gray-300 transition flex justify-between items-center"
                      >
                        <div>
                          <p className="font-semibold text-gray-200">{p.name}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{p.customer?.name || 'Müşteri yok'}</p>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-violet-500/10 text-violet-400 text-[10px]">{p.stage}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Cariler */}
              {results.caris.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-violet-400 mb-1.5 px-2 uppercase tracking-wider">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Cari Hesaplar (Borçlar)</span>
                  </div>
                  <div className="space-y-1">
                    {results.caris.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => handleItemClick('caris', c.id)}
                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-violet-950/20 border border-transparent hover:border-violet-500/10 text-xs text-gray-300 transition flex justify-between items-center"
                      >
                        <div>
                          <p className="font-semibold text-gray-200">{c.name}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{c.phone || 'Telefon yok'}</p>
                        </div>
                        <span className="text-[10px] text-rose-400 font-mono">₺{c.currentBalance.toLocaleString('tr-TR')}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Görevler */}
              {results.tasks.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-violet-400 mb-1.5 px-2 uppercase tracking-wider">
                    <CheckSquare className="w-3.5 h-3.5" />
                    <span>Görevler</span>
                  </div>
                  <div className="space-y-1">
                    {results.tasks.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => handleItemClick('tasks', t.id)}
                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-violet-950/20 border border-transparent hover:border-violet-500/10 text-xs text-gray-300 transition flex justify-between items-center"
                      >
                        <div>
                          <p className="font-semibold text-gray-200">{t.title}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{t.project?.name ? `Proje: ${t.project.name}` : 'Bağımsız Görev'}</p>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-violet-500/10 text-violet-400 text-[10px]">{t.status}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Alt Bilgi Kısayolları */}
        <div className="px-4 py-2.5 border-t border-violet-500/10 bg-violet-950/5 text-[10px] text-gray-500 flex justify-between items-center font-mono">
          <span>Kapatmak için <kbd className="bg-violet-950/20 px-1.5 py-0.5 rounded border border-violet-500/10">ESC</kbd> tuşuna basın.</span>
          <span>Sonuca gitmek için tıklayın.</span>
        </div>
      </div>
    </div>
  )
}
