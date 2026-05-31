import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST() {
  try {
    // En son oluşturulan log kaydını bul
    const latestLog = await prisma.actionLog.findFirst({
      orderBy: { createdAt: 'desc' },
    })

    if (!latestLog) {
      return NextResponse.json(
        { error: 'Geri alınacak son bir işlem bulunamadı!' },
        { status: 404 }
      )
    }

    const { id, actionType, modelName, modelId, previousData } = latestLog
    const parsedData = JSON.parse(previousData || '{}')
    const modelKey = modelName.toLowerCase()

    // Geri alma mantığı
    if (actionType === 'INSERT') {
      // Ekleme yapıldıysa geri almak için kaydı veritabanından siliyoruz
      await prisma[modelKey].delete({
        where: { id: modelId },
      })
    } else if (actionType === 'UPDATE') {
      // Güncelleme yapıldıysa eski halini veritabanına geri yazıyoruz
      const dataToRestore = { ...parsedData }

      // İlişkili tabloları update datasına dahil etmemeliyiz
      delete dataToRestore.projects
      delete dataToRestore.customer

      // Tarih alanlarını JavaScript Date nesnelerine dönüştür
      if (dataToRestore.deliveryDate) dataToRestore.deliveryDate = new Date(dataToRestore.deliveryDate)
      if (dataToRestore.date) dataToRestore.date = new Date(dataToRestore.date)
      if (dataToRestore.createdAt) dataToRestore.createdAt = new Date(dataToRestore.createdAt)
      if (dataToRestore.updatedAt) dataToRestore.updatedAt = new Date(dataToRestore.updatedAt)

      await prisma[modelKey].update({
        where: { id: modelId },
        data: dataToRestore,
      })
    } else if (actionType === 'DELETE') {
      // Silme yapıldıysa eski ID'si ve verileriyle kaydı tekrar oluşturuyoruz
      const dataToRestore = { ...parsedData }

      delete dataToRestore.projects
      delete dataToRestore.customer

      // Tarih alanlarını JavaScript Date nesnelerine dönüştür
      if (dataToRestore.deliveryDate) dataToRestore.deliveryDate = new Date(dataToRestore.deliveryDate)
      if (dataToRestore.date) dataToRestore.date = new Date(dataToRestore.date)
      if (dataToRestore.createdAt) dataToRestore.createdAt = new Date(dataToRestore.createdAt)
      if (dataToRestore.updatedAt) dataToRestore.updatedAt = new Date(dataToRestore.updatedAt)

      await prisma[modelKey].create({
        data: dataToRestore,
      })
    }

    // Başarıyla geri alındıktan sonra bu log kaydını siliyoruz ki
    // bir sonraki tıklamada bir önceki işleme geçebilelim (zincirleme undo)
    await prisma.actionLog.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      undoneAction: {
        actionType,
        modelName,
        modelId,
      },
    })
  } catch (error) {
    console.error('Geri alma hatası:', error)
    return NextResponse.json(
      { error: `Geri alma başarısız oldu: ${error.message}` },
      { status: 500 }
    )
  }
}
