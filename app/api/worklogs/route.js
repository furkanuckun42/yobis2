import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logAction } from '@/lib/logger'
import { notifyAdmins } from '@/lib/notifications'

export async function GET(request) {
  try {
    const requesterId = request.headers.get('x-requester-id')
    const requesterRole = request.headers.get('x-requester-role')

    if (!requesterId) {
      return NextResponse.json({ error: 'Giriş yapmanız gerekmektedir.' }, { status: 401 })
    }

    if (requesterRole === 'admin') {
      // Admin her çalışanın kaydını görebilir
      const logs = await prisma.workLog.findMany({
        orderBy: { date: 'desc' },
        include: {
          employee: true
        }
      })
      return NextResponse.json(logs)
    } else {
      // Personel sadece kendi çalışan kaydına ait verileri görebilir
      const employee = await prisma.employee.findUnique({
        where: { userId: requesterId }
      })

      if (!employee) {
        return NextResponse.json([]) // Eşleşmiş çalışan yoksa boş liste dön
      }

      const logs = await prisma.workLog.findMany({
        where: { employeeId: employee.id },
        orderBy: { date: 'desc' },
        include: {
          employee: true
        }
      })
      return NextResponse.json(logs)
    }
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const requesterId = request.headers.get('x-requester-id')
    const requesterRole = request.headers.get('x-requester-role')

    if (!requesterId) {
      return NextResponse.json({ error: 'Giriş yapmanız gerekmektedir.' }, { status: 401 })
    }

    const data = await request.json()
    const { employeeId, date, type, amount, description } = data

    if (!date || !type) {
      return NextResponse.json({ error: 'Tarih ve çalışma türü seçilmelidir.' }, { status: 400 })
    }

    let targetEmployeeId = employeeId
    let targetEmployee = null

    if (requesterRole === 'admin') {
      if (!targetEmployeeId) {
        return NextResponse.json({ error: 'Çalışan seçimi zorunludur.' }, { status: 400 })
      }
      targetEmployee = await prisma.employee.findUnique({
        where: { id: targetEmployeeId }
      })
    } else {
      // Personel ise kendi çalışan kaydını bul
      targetEmployee = await prisma.employee.findUnique({
        where: { userId: requesterId }
      })
      if (!targetEmployee) {
        return NextResponse.json({ error: 'Profiliniz bir çalışan kaydıyla eşleşmemiş. Lütfen admin ile görüşün.' }, { status: 403 })
      }
      targetEmployeeId = targetEmployee.id
    }

    if (!targetEmployee) {
      return NextResponse.json({ error: 'Çalışan kaydı bulunamadı.' }, { status: 404 })
    }

    // Yevmiyeyi hesapla
    let rate = 0
    if (type === 'UZAKTAN') {
      rate = parseFloat(amount) || 0
    } else {
      rate = type === 'TAM' ? targetEmployee.fullDayRate : targetEmployee.halfDayRate
    }

    const log = await prisma.workLog.create({
      data: {
        employeeId: targetEmployeeId,
        date: new Date(date),
        type,
        status: 'ODENMEDI', // Varsayılan olarak ödenmedi
        amount: rate,
        description: type === 'UZAKTAN' ? description : null,
      },
      include: {
        employee: true
      }
    })

    const requesterUsername = request.headers.get('x-requester-username') || 'Sistem'
    await logAction('INSERT', 'WorkLog', log.id, log, requesterUsername)

    await notifyAdmins({
      message: `👷 İş Kaydı Eklendi: ${requesterUsername}, ${targetEmployee.name} için çalışma kaydı girdi (${type === 'TAM' ? 'Tam Gün' : type === 'YARIM' ? 'Yarım Gün' : 'Uzaktan'} | ${rate} TL)`,
      tab: 'worklogs',
      requesterRole
    })

    return NextResponse.json(log)
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(request) {
  try {
    const requesterId = request.headers.get('x-requester-id')
    const requesterRole = request.headers.get('x-requester-role')

    if (!requesterId) {
      return NextResponse.json({ error: 'Giriş yapmanız gerekmektedir.' }, { status: 401 })
    }

    const data = await request.json()
    const { id, ids, status, type, date, amount, description } = data

    // Toplu Güncelleme Desteği
    if (ids && Array.isArray(ids)) {
      if (requesterRole !== 'admin') {
        return NextResponse.json({ error: 'Toplu güncelleme yetkisi sadece yöneticilerdedir.' }, { status: 403 })
      }
      
      const updatedLogs = []
      for (const targetId of ids) {
        const existing = await prisma.workLog.findUnique({
          where: { id: targetId },
          include: { employee: true }
        })
        if (!existing) continue;

        let updateData = { status }
        
        // Kasa Ödeme/Tahsilat Güncellemeleri
        if (status === 'ODENDI' && existing.status !== 'ODENDI') {
          await prisma.finance.create({
            data: {
              type: 'GIDER',
              category: 'KASA',
              amount: existing.amount,
              description: `${existing.employee.name} için yevmiye ödemesi (${new Date(existing.date).toLocaleDateString('tr-TR')})`,
              date: new Date(),
              workLogId: existing.id
            }
          })
        } else if (status === 'ODENMEDI' && existing.status === 'ODENDI') {
          await prisma.finance.deleteMany({
            where: { workLogId: existing.id }
          })
        }

        const updated = await prisma.workLog.update({
          where: { id: targetId },
          data: updateData,
          include: { employee: true }
        })
        const requesterUsername = request.headers.get('x-requester-username') || 'Sistem'
        await logAction('UPDATE', 'WorkLog', targetId, existing, requesterUsername)
        updatedLogs.push(updated)
      }

      if (updatedLogs.length > 0) {
        const requesterUsername = request.headers.get('x-requester-username') || 'Sistem'
        await notifyAdmins({
          message: `💳 Toplu Ödeme Güncellemesi: ${requesterUsername}, ${updatedLogs.length} adet yevmiyenin ödeme durumunu "${status === 'ODENDI' ? 'Ödendi' : 'Ödenmedi'}" yaptı.`,
          tab: 'worklogs',
          requesterRole
        })
      }

      return NextResponse.json({ success: true, count: updatedLogs.length })
    }

    if (!id) {
      return NextResponse.json({ error: 'ID parametresi zorunludur.' }, { status: 400 })
    }

    const existing = await prisma.workLog.findUnique({
      where: { id },
      include: { employee: true }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Çalışma kaydı bulunamadı.' }, { status: 404 })
    }

    // Yetki kontrolü: Personel ise sadece kendi kaydını değiştirebilir ve sadece ODENMEDI durumundakileri güncelleyebilir.
    if (requesterRole !== 'admin') {
      if (existing.employee.userId !== requesterId) {
        return NextResponse.json({ error: 'Bu işlem için yetkiniz bulunmamaktadır.' }, { status: 403 })
      }
      if (existing.status === 'ODENDI') {
        return NextResponse.json({ error: 'Ödenmiş kayıtlar üzerinde değişiklik yapılamaz.' }, { status: 403 })
      }
      if (status !== undefined && status !== 'ODENMEDI') {
        return NextResponse.json({ error: 'Personeller ödeme durumu güncelleyemez.' }, { status: 403 })
      }
    }

    let updateData = {}
    if (status !== undefined && requesterRole === 'admin') {
      updateData.status = status
    }

    if (type !== undefined || date !== undefined || amount !== undefined || description !== undefined) {
      // Eğer çalışma türü değişirse ücreti yeniden hesapla
      const finalType = type !== undefined ? type : existing.type
      const finalDate = date !== undefined ? new Date(date) : existing.date
      let rate = existing.amount

      if (type !== undefined || amount !== undefined) {
        if (finalType === 'UZAKTAN') {
          rate = amount !== undefined ? parseFloat(amount) : (existing.type === 'UZAKTAN' ? existing.amount : 0)
        } else {
          rate = finalType === 'TAM' ? existing.employee.fullDayRate : existing.employee.halfDayRate
        }
      }

      updateData.type = finalType
      updateData.date = finalDate
      updateData.amount = rate
      updateData.description = finalType === 'UZAKTAN' ? (description !== undefined ? description : existing.description) : null
    }

    // Kasa Ödeme/Tahsilat Güncellemeleri
    if (status === 'ODENDI' && existing.status !== 'ODENDI') {
      // Ödendi yapıldığında Kasadan Gider düşüyoruz
      const finalAmount = updateData.amount !== undefined ? updateData.amount : existing.amount
      await prisma.finance.create({
        data: {
          type: 'GIDER',
          category: 'KASA',
          amount: finalAmount,
          description: `${existing.employee.name} için yevmiye ödemesi (${new Date(existing.date).toLocaleDateString('tr-TR')})`,
          date: new Date(),
          workLogId: existing.id
        }
      })
    } else if (status === 'ODENMEDI' && existing.status === 'ODENDI') {
      // Ödeme iptal edildiğinde Kasa gider kaydını siliyoruz
      await prisma.finance.deleteMany({
        where: { workLogId: existing.id }
      })
    } else if (existing.status === 'ODENDI' && updateData.amount !== undefined && updateData.amount !== existing.amount) {
      // Eğer ödenmiş kaydın tutarı değiştiyse Kasa gider tutarını da güncelliyoruz
      await prisma.finance.updateMany({
        where: { workLogId: existing.id },
        data: { amount: updateData.amount }
      })
    }

    const updatedLog = await prisma.workLog.update({
      where: { id },
      data: updateData,
      include: {
        employee: true
      }
    })

    const requesterUsername = request.headers.get('x-requester-username') || 'Sistem'
    await logAction('UPDATE', 'WorkLog', id, existing, requesterUsername)

    await notifyAdmins({
      message: `✍️ İş Kaydı Güncellendi: ${requesterUsername}, ${existing.employee.name} adına ait çalışma kaydını düzenledi.`,
      tab: 'worklogs',
      requesterRole
    })

    return NextResponse.json(updatedLog)
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    const requesterId = request.headers.get('x-requester-id')
    const requesterRole = request.headers.get('x-requester-role')

    if (!requesterId) {
      return NextResponse.json({ error: 'Giriş yapmanız gerekmektedir.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID parametresi zorunludur.' }, { status: 400 })
    }

    const existing = await prisma.workLog.findUnique({
      where: { id },
      include: { employee: true }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Kayıt bulunamadı.' }, { status: 404 })
    }

    // Yetki kontrolü: Personel ise sadece kendi kaydını silebilmeli ve sadece ODENMEDI olanları.
    if (requesterRole !== 'admin') {
      if (existing.employee.userId !== requesterId) {
        return NextResponse.json({ error: 'Yetkisiz işlem.' }, { status: 403 })
      }
      if (existing.status === 'ODENDI') {
        return NextResponse.json({ error: 'Ödenmiş kayıtlar silinemez.' }, { status: 403 })
      }
    }

    // İlişkili Kasa ödeme kayıtlarını sil
    await prisma.finance.deleteMany({
      where: { workLogId: id }
    })

    await prisma.workLog.delete({ where: { id } })
    const requesterUsername = request.headers.get('x-requester-username') || 'Sistem'
    await logAction('DELETE', 'WorkLog', id, existing, requesterUsername)

    await notifyAdmins({
      message: `🗑️ İş Kaydı Silindi: ${requesterUsername}, ${existing.employee.name} adına ait çalışma kaydını sildi.`,
      tab: 'worklogs',
      requesterRole
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
