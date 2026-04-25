type RainViewerMapsJson = {
  host?: string
  radar?: {
    past?: Array<{ time?: number; path?: string }>
  }
}

/**
 * Retorna URL de tiles RainViewer (frame radar mais recente).
 * @see https://www.rainviewer.com/api.html
 */
export async function fetchRainViewerRadarTileUrlTemplate(): Promise<string> {
  const res = await fetch('https://api.rainviewer.com/public/weather-maps.json')
  if (!res.ok) {
    throw new Error(`RainViewer HTTP ${String(res.status)}`)
  }
  const data = (await res.json()) as RainViewerMapsJson
  const host = (data.host ?? 'https://tilecache.rainviewer.com').replace(/\/$/, '')
  const past = data.radar?.past
  if (!past?.length) {
    throw new Error('RainViewer: sem frames past')
  }
  const latest = past[past.length - 1]
  const path = latest?.path?.trim()
  if (!path) {
    throw new Error('RainViewer: path invalido')
  }
  const base = path.startsWith('/') ? `${host}${path}` : `${host}/${path}`
  return `${base}/256/{z}/{x}/{y}/2/1_1.png`
}
