'use client'

import { useState, useEffect, useCallback } from 'react'
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react'

const TOAST_ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info
}

const TOAST_STYLES = {
  success: {
    border: 'border-emerald-500/30',
    bg: 'bg-emerald-950/80',
    icon: 'text-emerald-400',
    text: 'text-emerald-100',
    progress: 'bg-emerald-500',
    glow: 'shadow-emerald-500/10'
  },
  error: {
    border: 'border-rose-500/30',
    bg: 'bg-rose-950/80',
    icon: 'text-rose-400',
    text: 'text-rose-100',
    progress: 'bg-rose-500',
    glow: 'shadow-rose-500/10'
  },
  warning: {
    border: 'border-amber-500/30',
    bg: 'bg-amber-950/80',
    icon: 'text-amber-400',
    text: 'text-amber-100',
    progress: 'bg-amber-500',
    glow: 'shadow-amber-500/10'
  },
  info: {
    border: 'border-violet-500/30',
    bg: 'bg-violet-950/80',
    icon: 'text-violet-400',
    text: 'text-violet-100',
    progress: 'bg-violet-500',
    glow: 'shadow-violet-500/10'
  }
}

function SingleToast({ toast, onRemove }) {
  const [isExiting, setIsExiting] = useState(false)
  const [progress, setProgress] = useState(100)
  const style = TOAST_STYLES[toast.type] || TOAST_STYLES.info
  const Icon = TOAST_ICONS[toast.type] || Info
  const duration = toast.duration || 4000

  useEffect(() => {
    const startTime = Date.now()
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100)
      setProgress(remaining)
      if (remaining <= 0) {
        clearInterval(interval)
      }
    }, 50)

    const timer = setTimeout(() => {
      handleClose()
    }, duration)

    return () => {
      clearInterval(interval)
      clearTimeout(timer)
    }
  }, [duration])

  const handleClose = () => {
    setIsExiting(true)
    setTimeout(() => {
      onRemove(toast.id)
    }, 300)
  }

  return (
    <div
      className={`
        relative flex items-start gap-3 px-4 py-3.5 rounded-xl border backdrop-blur-xl
        shadow-xl ${style.glow} ${style.border} ${style.bg}
        ${isExiting ? 'animate-toast-exit' : 'animate-toast-enter'}
        min-w-[300px] max-w-[420px] cursor-pointer group
      `}
      onClick={handleClose}
      role="alert"
    >
      <Icon className={`w-5 h-5 ${style.icon} shrink-0 mt-0.5`} />
      <p className={`text-sm font-medium ${style.text} leading-snug flex-1`}>
        {toast.message}
      </p>
      <button
        onClick={(e) => { e.stopPropagation(); handleClose() }}
        className="p-0.5 rounded-md text-gray-500 hover:text-white transition opacity-0 group-hover:opacity-100 shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-white/5 overflow-hidden">
        <div
          className={`h-full ${style.progress} rounded-full transition-all duration-100 ease-linear opacity-60`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}

export default function ToastContainer({ toasts, removeToast }) {
  if (!toasts || toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2.5 pointer-events-auto">
      {toasts.map(toast => (
        <SingleToast key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </div>
  )
}
