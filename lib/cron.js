import { prisma } from './prisma'
import { notifyAdmins } from './notifications'

let cronInterval;

export function startCron() {
  if (cronInterval) return;
  console.log('⏰ Kasa Bildirimi Cron Görevi Başlatıldı.');
  
  let lastSentDate = '';
  
  cronInterval = setInterval(async () => {
    try {
      const now = new Date();
      // Türkiye saati (UTC+3)
      const trTime = new Date(now.getTime() + 3 * 60 * 60 * 1000);
      const hour = trTime.getUTCHours();
      const minute = trTime.getUTCMinutes();
      const dateStr = trTime.toISOString().split('T')[0];

      if (hour === 19 && minute === 0) {
        if (lastSentDate !== dateStr) {
          lastSentDate = dateStr;
          
          // Kasa bakiyesini hesapla
          const aggGelir = await prisma.finance.aggregate({
            where: { category: 'KASA', type: 'GELIR' },
            _sum: { amount: true }
          });
          const aggGider = await prisma.finance.aggregate({
            where: { category: 'KASA', type: 'GIDER' },
            _sum: { amount: true }
          });
          const balance = (aggGelir._sum.amount || 0) - (aggGider._sum.amount || 0);
          
          // Biçimlendirme
          const formattedBalance = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(balance);
          
          console.log(`⏰ Kasa Bildirimi gönderiliyor. Güncel Kasa: ${formattedBalance}`);
          await notifyAdmins({
            message: `💰 Güncel Kasa Bildirimi: Güncel kasa bakiyeniz ${formattedBalance}.`,
            tab: 'finance'
          });
        }
      }
    } catch (err) {
      console.error('Cron Görevi Hatası:', err);
    }
  }, 60000); // Her dakika kontrol et
}
