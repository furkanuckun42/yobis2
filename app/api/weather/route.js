import { NextResponse } from 'next/server'

export async function GET() {
  // 1. Önce Open-Meteo API'sini dene (Varsayılan)
  try {
    const res = await fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=37.8714&longitude=32.4847&current_weather=true',
      {
        next: { revalidate: 300 }, // 5 dakika önbellekle
        signal: AbortSignal.timeout(3000) // 3 saniye zaman aşımı
      }
    )
    
    if (res.ok) {
      const data = await res.json()
      if (data.current_weather) {
        return NextResponse.json(data)
      }
    }
  } catch (error) {
    console.warn('Open-Meteo API hatası, alternatif wttr.in deneniyor:', error.message)
  }

  // 2. Open-Meteo çökmüşse, alternatif olarak wttr.in JSON API'sini dene
  try {
    const res = await fetch(
      'https://wttr.in/Konya?format=j1',
      {
        next: { revalidate: 300 },
        signal: AbortSignal.timeout(3000)
      }
    )
    
    if (res.ok) {
      const data = await res.json()
      const condition = data?.current_condition?.[0]
      
      if (condition) {
        const temp = parseFloat(condition.temp_C || '22')
        const wttrCode = parseInt(condition.weatherCode || '116')
        
        // wttr.in (World Weather Online) kodlarını Open-Meteo uyumlu kodlara eşle:
        let weathercode = 1
        if (wttrCode === 113) weathercode = 0 // Güneşli
        else if ([116, 119].includes(wttrCode)) weathercode = 2 // Parçalı Bulutlu
        else if (wttrCode === 122) weathercode = 3 // Kapalı
        else if ([143, 248, 260].includes(wttrCode)) weathercode = 45 // Sisli
        else if ([176, 263, 266, 293, 296, 299, 302, 305, 308, 353, 356, 359].includes(wttrCode)) weathercode = 61 // Yağmurlu
        else if ([179, 227, 230, 323, 326, 329, 332, 335, 338, 368, 371].includes(wttrCode)) weathercode = 71 // Karlı

        return NextResponse.json({
          current_weather: {
            temperature: temp,
            weathercode: weathercode,
            isFallback: true
          }
        })
      }
    }
  } catch (error) {
    console.warn('Alternatif wttr.in de başarısız oldu, çevrimdışı yedek moduna geçiliyor:', error.message)
  }

  // 3. Her iki servis de kapalıysa veya internet yoksa,
  // uygulamayı bozmamak adına sabit, gerçekçi bir yedek değer dön
  return NextResponse.json({
    current_weather: {
      temperature: 21,
      weathercode: 2, // Parçalı Bulutlu
      isOfflineData: true
    }
  })
}
