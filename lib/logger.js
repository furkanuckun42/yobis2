import { prisma } from './prisma'

/**
 * Veritabanı değişikliklerini ActionLog tablosuna kaydeder.
 * Geri alma (Undo) mekanizması için kullanılır.
 * 
 * @param {string} actionType - "INSERT", "UPDATE" veya "DELETE"
 * @param {string} modelName - Değişen model adı (örn: "Customer", "Project", "Finance", "Equipment")
 * @param {string} modelId - Değişen kaydın ID değeri
 * @param {object} previousData - Güncelleme veya silme öncesi kaydın eski hali (INSERT ise null/boş olabilir)
 */
export async function logAction(actionType, modelName, modelId, previousData, username = 'Sistem') {
  try {
    await prisma.actionLog.create({
      data: {
        actionType,
        modelName,
        modelId,
        previousData: previousData ? JSON.stringify(previousData) : '{}',
        username: decodeURIComponent(username),
      },
    })
  } catch (error) {
    console.error('ActionLog oluşturma hatası:', error)
  }
}
