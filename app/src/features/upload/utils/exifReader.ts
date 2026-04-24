import * as exifr from 'exifr'

type GpsCoordinates = { lat: number; lon: number }

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('Falha ao ler arquivo'))
    reader.readAsDataURL(file)
  })
}

export async function readGps(file: File): Promise<GpsCoordinates | null> {
  try {
    const gps = await exifr.gps(file)
    const latitude = gps?.latitude
    const longitude = gps?.longitude

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return null
    }

    return { lat: latitude, lon: longitude }
  } catch {
    return null
  }
}

export async function hasGpsData(file: File): Promise<boolean> {
  const gps = await readGps(file)
  return Boolean(gps)
}

export async function generateThumbnail(file: File, size = 80): Promise<string> {
  if (!file.type.startsWith('image/')) {
    return ''
  }

  try {
    const bitmap = await createImageBitmap(file)
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')

    if (!context) {
      bitmap.close()
      return fileToDataUrl(file)
    }

    canvas.width = size
    canvas.height = size

    const scale = Math.max(size / bitmap.width, size / bitmap.height)
    const width = bitmap.width * scale
    const height = bitmap.height * scale
    const x = (size - width) / 2
    const y = (size - height) / 2

    context.drawImage(bitmap, x, y, width, height)
    bitmap.close()

    return canvas.toDataURL('image/jpeg', 0.85)
  } catch {
    return fileToDataUrl(file)
  }
}

export async function readAll(file: File): Promise<Record<string, unknown>> {
  try {
    const data = await exifr.parse(file, { gps: true, tiff: true, exif: true })
    return (data ?? {}) as Record<string, unknown>
  } catch {
    return {}
  }
}
