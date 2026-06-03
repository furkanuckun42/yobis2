'use client'

import { useState } from 'react'

export default function Charts({ data = [], records = [], selectedMonth = 'ALL' }) {
  const [hoveredIndex, setHoveredIndex] = useState(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  const [activeChartTab, setActiveChartTab] = useState('trend')

  const formatMonthYear = (monthStr) => {
    if (!monthStr || monthStr === 'ALL') return 'Tüm Zamanlar'
    const [year, month] = monthStr.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1, 1)
    return date.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })
  }

  const filteredRecords = selectedMonth === 'ALL'
    ? records
    : records.filter(r => {
        const d = new Date(r.date)
        const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        return mStr === selectedMonth
      })

  const expenseRecords = filteredRecords.filter(r => r.type === 'GIDER')
  const totalExpenses = expenseRecords.reduce((sum, r) => sum + r.amount, 0)
  
  const expenseCategories = {
    personel: expenseRecords.filter(r => r.workLogId != null).reduce((sum, r) => sum + r.amount, 0),
    cari: expenseRecords.filter(r => r.category === 'CARI' || r.cariId != null).reduce((sum, r) => sum + r.amount, 0),
    diger: expenseRecords.filter(r => r.workLogId == null && r.category === 'KASA' && r.cariId == null).reduce((sum, r) => sum + r.amount, 0)
  }
  
  const incomeRecords = filteredRecords.filter(r => r.type === 'GELIR')
  const totalIncomes = incomeRecords.reduce((sum, r) => sum + r.amount, 0)
  
  const incomeCategories = {
    vsk: incomeRecords.filter(r => r.description && r.description.trim().toUpperCase() === 'VSK').reduce((sum, r) => sum + r.amount, 0),
    customer: incomeRecords.filter(r => r.customerId != null && !(r.description && r.description.trim().toUpperCase() === 'VSK')).reduce((sum, r) => sum + r.amount, 0),
    diger: incomeRecords.filter(r => r.customerId == null && !(r.description && r.description.trim().toUpperCase() === 'VSK')).reduce((sum, r) => sum + r.amount, 0)
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center border border-dashed border-violet-950/30 rounded-xl bg-violet-950/5">
        <p className="text-gray-400 text-sm">Grafik için yeterli finansal veri bulunmuyor.</p>
      </div>
    )
  }

  // Grafik boyutları
  const width = 600
  const height = 280
  const padding = { top: 30, right: 30, bottom: 40, left: 60 }
  
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom

  // Maksimum Y değerini hesapla
  const maxVal = Math.max(
    ...data.map(d => Math.max(d.income || 0, d.expense || 0, d.profit || 0, 1000))
  )
  const maxY = Math.ceil(maxVal * 1.15 / 1000) * 1000 // %15 marj ekle ve 1000'e yuvarla

  // Koordinat dönüştürme fonksiyonları
  const getX = (index) => {
    if (data.length <= 1) return padding.left + chartWidth / 2
    return padding.left + (index * (chartWidth / (data.length - 1)))
  }

  const getY = (value) => {
    const ratio = Math.max(0, Math.min(1, value / maxY))
    return padding.top + chartHeight - (ratio * chartHeight)
  }

  // Noktaları oluştur
  const incomePoints = data.map((d, i) => ({ x: getX(i), y: getY(d.income || 0), val: d.income || 0 }))
  const expensePoints = data.map((d, i) => ({ x: getX(i), y: getY(d.expense || 0), val: d.expense || 0 }))
  const profitPoints = data.map((d, i) => ({ x: getX(i), y: getY(d.profit || 0), val: d.profit || 0 }))

  // SVG Path Oluşturucular
  const getLinePath = (points) => {
    if (points.length === 0) return ''
    return points.reduce((path, p, i) => {
      return i === 0 ? `M ${p.x} ${p.y}` : `${path} L ${p.x} ${p.y}`
    }, '')
  }

  const getAreaPath = (points) => {
    if (points.length === 0) return ''
    const linePath = getLinePath(points)
    const first = points[0]
    const last = points[points.length - 1]
    const baseY = padding.top + chartHeight
    return `${linePath} L ${last.x} ${baseY} L ${first.x} ${baseY} Z`
  }

  const handleMouseMove = (e) => {
    const svg = e.currentTarget
    const rect = svg.getBoundingClientRect()
    const clientX = e.clientX - rect.left
    
    // SVG içindeki X oranına göre en yakın veriyi bul
    const svgX = (clientX / rect.width) * width
    const dataX = svgX - padding.left
    const percent = dataX / chartWidth
    const index = Math.max(0, Math.min(data.length - 1, Math.round(percent * (data.length - 1))))
    
    setHoveredIndex(index)

    // Tooltip pozisyonu
    const xPos = getX(index)
    setTooltipPos({
      x: xPos,
      y: Math.min(incomePoints[index].y, expensePoints[index].y, profitPoints[index].y) - 10
    })
  }

  const handleMouseLeave = () => {
    setHoveredIndex(null)
  }

  // Grid çizgileri Y değerleri
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(r => ({
    y: padding.top + chartHeight * r,
    val: Math.round(maxY * (1 - r))
  }))

  return (
    <div className="relative glass-card p-5 rounded-2xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-violet-500/10 pb-4">
        <div className="text-left">
          <h3 className="text-md font-semibold text-gray-200">Gelişmiş Finansal Analitik</h3>
          <p className="text-xs text-gray-400">Trend, gider kalemi ve gelir kaynağı analizleri</p>
        </div>
        
        {/* Tab Selector */}
        <div className="flex bg-violet-950/40 p-1 rounded-xl border border-violet-500/10 self-start">
          <button
            type="button"
            onClick={() => setActiveChartTab('trend')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeChartTab === 'trend'
                ? 'bg-violet-600 text-white shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Trend Akışı
          </button>
          <button
            type="button"
            onClick={() => setActiveChartTab('expense')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeChartTab === 'expense'
                ? 'bg-rose-600 text-white shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Harcama Dağılımı
          </button>
          <button
            type="button"
            onClick={() => setActiveChartTab('income')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeChartTab === 'income'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Gelir Dağılımı
          </button>
        </div>
      </div>

      {activeChartTab === 'trend' ? (
        <div className="relative w-full overflow-hidden">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-auto select-none overflow-visible"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            <defs>
              {/* Degradeler */}
              <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.0" />
              </linearGradient>

              {/* Glow Filtresi */}
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Grid Çizgileri */}
            {gridLines.map((line, idx) => (
              <g key={idx}>
                <line
                  x1={padding.left}
                  y1={line.y}
                  x2={width - padding.right}
                  y2={line.y}
                  stroke="rgba(139, 92, 246, 0.08)"
                  strokeDasharray="4 4"
                />
                <text
                  x={padding.left - 12}
                  y={line.y + 4}
                  fill="#9ca3af"
                  fontSize="10"
                  textAnchor="end"
                  className="font-mono opacity-80"
                >
                  ₺{line.val.toLocaleString('tr-TR')}
                </text>
              </g>
            ))}

            {/* X Ekseni Ayları */}
            {data.map((d, i) => (
              <text
                key={i}
                x={getX(i)}
                y={height - padding.bottom + 22}
                fill={hoveredIndex === i ? '#a855f7' : '#9ca3af'}
                fontSize="11"
                textAnchor="middle"
                className="transition-colors duration-150 font-medium"
              >
                {d.month}
              </text>
            ))}

            {/* Dikey Kılavuz Çizgisi (Hover durumunda) */}
            {hoveredIndex !== null && (
              <line
                x1={getX(hoveredIndex)}
                y1={padding.top}
                x2={getX(hoveredIndex)}
                y2={padding.top + chartHeight}
                stroke="rgba(168, 85, 247, 0.25)"
                strokeWidth="1.5"
                strokeDasharray="2 2"
              />
            )}

            {/* Dolgu Alanları (Gradients) */}
            <path d={getAreaPath(incomePoints)} fill="url(#incomeGrad)" />
            <path d={getAreaPath(expensePoints)} fill="url(#expenseGrad)" />
            <path d={getAreaPath(profitPoints)} fill="url(#profitGrad)" />

            {/* Çizgiler */}
            <path
              d={getLinePath(incomePoints)}
              fill="none"
              stroke="#10b981"
              strokeWidth="2.5"
            />
            <path
              d={getLinePath(expensePoints)}
              fill="none"
              stroke="#f43f5e"
              strokeWidth="2.5"
            />
            <path
              d={getLinePath(profitPoints)}
              fill="none"
              stroke="#8b5cf6"
              strokeWidth="2.5"
            />

            {/* Noktalar ve Etkileşim Çemberleri */}
            {data.map((d, i) => {
              const isHovered = hoveredIndex === i
              return (
                <g key={i}>
                  {/* Gelir Noktası */}
                  <circle
                    cx={getX(i)}
                    cy={getY(d.income || 0)}
                    r={isHovered ? 5.5 : 3.5}
                    fill="#10b981"
                    stroke="#0a0516"
                    strokeWidth="1.5"
                    className="transition-all duration-150"
                  />
                  {/* Gider Noktası */}
                  <circle
                    cx={getX(i)}
                    cy={getY(d.expense || 0)}
                    r={isHovered ? 5.5 : 3.5}
                    fill="#f43f5e"
                    stroke="#0a0516"
                    strokeWidth="1.5"
                    className="transition-all duration-150"
                  />
                  {/* Net Kar Noktası */}
                  <circle
                    cx={getX(i)}
                    cy={getY(d.profit || 0)}
                    r={isHovered ? 5.5 : 3.5}
                    fill="#8b5cf6"
                    stroke="#0a0516"
                    strokeWidth="1.5"
                    className="transition-all duration-150"
                  />
                </g>
              )
            })}
          </svg>

          {/* Hover Tooltip Overlay */}
          {hoveredIndex !== null && data[hoveredIndex] && (
            <div
              className="absolute z-10 p-3 bg-[#0c081c]/95 border border-violet-500/20 rounded-xl shadow-2xl pointer-events-none text-xs font-medium"
              style={{
                left: `${(tooltipPos.x / width) * 100}%`,
                top: `${(tooltipPos.y / height) * 100}%`,
                transform: 'translate(-50%, -100%)',
              }}
            >
              <div className="text-purple-400 font-bold mb-1 border-b border-violet-950/30 pb-0.5">
                {data[hoveredIndex].month} Raporu
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-gray-300">
                <span>Gelir:</span>
                <span className="text-emerald-400 font-mono text-right">
                  ₺{data[hoveredIndex].income.toLocaleString('tr-TR')}
                </span>
                <span>Gider:</span>
                <span className="text-rose-400 font-mono text-right">
                  ₺{data[hoveredIndex].expense.toLocaleString('tr-TR')}
                </span>
                <span className="font-semibold">Net Kâr:</span>
                <span className="text-violet-400 font-mono font-bold text-right">
                  ₺{data[hoveredIndex].profit.toLocaleString('tr-TR')}
                </span>
              </div>
            </div>
          )}
        </div>
      ) : activeChartTab === 'expense' ? (
        <div className="py-6 space-y-6 text-left">
          <h4 className="text-sm font-bold text-gray-300">Gider Kalemleri Analizi ({formatMonthYear(selectedMonth)})</h4>
          <div className="space-y-4">
            {/* Personel Giderleri */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Personel Maaş/Yevmiye Ödemeleri</span>
                <span className="text-white font-bold">
                  {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(expenseCategories.personel)}
                  <span className="text-gray-500 ml-1.5 font-normal">
                    ({totalExpenses > 0 ? ((expenseCategories.personel / totalExpenses) * 100).toFixed(1) : 0}%)
                  </span>
                </span>
              </div>
              <div className="w-full h-3 bg-violet-950/30 border border-violet-500/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-rose-500 rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]"
                  style={{ width: `${totalExpenses > 0 ? (expenseCategories.personel / totalExpenses) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Cari Giderleri */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Cari Firma / Dış Borç Ödemeleri</span>
                <span className="text-white font-bold">
                  {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(expenseCategories.cari)}
                  <span className="text-gray-500 ml-1.5 font-normal">
                    ({totalExpenses > 0 ? ((expenseCategories.cari / totalExpenses) * 100).toFixed(1) : 0}%)
                  </span>
                </span>
              </div>
              <div className="w-full h-3 bg-violet-950/30 border border-violet-500/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-amber-500 rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]"
                  style={{ width: `${totalExpenses > 0 ? (expenseCategories.cari / totalExpenses) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Diğer Kasa Giderleri */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Diğer Kasa / Ofis Giderleri</span>
                <span className="text-white font-bold">
                  {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(expenseCategories.diger)}
                  <span className="text-gray-500 ml-1.5 font-normal">
                    ({totalExpenses > 0 ? ((expenseCategories.diger / totalExpenses) * 100).toFixed(1) : 0}%)
                  </span>
                </span>
              </div>
              <div className="w-full h-3 bg-violet-950/30 border border-violet-500/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-violet-500 rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(139,92,246,0.4)]"
                  style={{ width: `${totalExpenses > 0 ? (expenseCategories.diger / totalExpenses) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
          <div className="pt-4 border-t border-violet-500/10 flex justify-between text-xs font-bold text-gray-400">
            <span>Toplam Gider Hacmi:</span>
            <span className="text-rose-400 font-black">{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(totalExpenses)}</span>
          </div>
        </div>
      ) : (
        <div className="py-6 space-y-6 text-left">
          <h4 className="text-sm font-bold text-gray-300">Gelir Kaynakları Analizi ({formatMonthYear(selectedMonth)})</h4>
          <div className="space-y-4">
            {/* Müşteri Sabit Gelirleri */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Aylık Sabit Müşteri Hizmet Gelirleri</span>
                <span className="text-white font-bold">
                  {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(incomeCategories.customer)}
                  <span className="text-gray-500 ml-1.5 font-normal">
                    ({totalIncomes > 0 ? ((incomeCategories.customer / totalIncomes) * 100).toFixed(1) : 0}%)
                  </span>
                </span>
              </div>
              <div className="w-full h-3 bg-violet-950/30 border border-violet-500/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                  style={{ width: `${totalIncomes > 0 ? (incomeCategories.customer / totalIncomes) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* VSK Gelirleri */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">VSK Gelirleri</span>
                <span className="text-white font-bold">
                  {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(incomeCategories.vsk)}
                  <span className="text-gray-500 ml-1.5 font-normal">
                    ({totalIncomes > 0 ? ((incomeCategories.vsk / totalIncomes) * 100).toFixed(1) : 0}%)
                  </span>
                </span>
              </div>
              <div className="w-full h-3 bg-violet-950/30 border border-violet-500/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-amber-500 rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]"
                  style={{ width: `${totalIncomes > 0 ? (incomeCategories.vsk / totalIncomes) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Diğer Kasa Gelirleri */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Diğer Kasa / Proje Gelirleri</span>
                <span className="text-white font-bold">
                  {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(incomeCategories.diger)}
                  <span className="text-gray-500 ml-1.5 font-normal">
                    ({totalIncomes > 0 ? ((incomeCategories.diger / totalIncomes) * 100).toFixed(1) : 0}%)
                  </span>
                </span>
              </div>
              <div className="w-full h-3 bg-violet-950/30 border border-violet-500/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-cyan-500 rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(6,182,212,0.4)]"
                  style={{ width: `${totalIncomes > 0 ? (incomeCategories.diger / totalIncomes) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
          <div className="pt-4 border-t border-violet-500/10 flex justify-between text-xs font-bold text-gray-400">
            <span>Toplam Gelir Hacmi:</span>
            <span className="text-emerald-400 font-black">{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(totalIncomes)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
