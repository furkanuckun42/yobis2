import { PrismaClient } from '@prisma/client'

if (typeof process !== 'undefined' && !process.env.DATABASE_URL) {
  console.error("❌ HATA: DATABASE_URL ortam değişkeni bulunamadı! Lütfen canlı sunucu ayarlarında (Vercel Dashboard vb.) DATABASE_URL değişkenini tanımlayın.");
}

const globalForPrisma = globalThis

export const prisma = globalForPrisma.prisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Server-side initialization of Daily Kasa Cron
if (typeof window === 'undefined' && !globalThis.kasaCronStarted) {
  globalThis.kasaCronStarted = true
  import('./cron').then(m => m.startCron()).catch(err => console.error('Cron başlatılamadı:', err))
}
