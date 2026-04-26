/**
 * Detecta a capacidade WebGL do dispositivo para adaptar performance de renderização.
 * Crítico para tablets Android mid-range rodando via Capacitor WebView.
 */
export type DeviceTier = 'high' | 'low' | 'none'

// GPUs com boa performance WebGL em WebView (Adreno 6xx/7xx, Mali-G70+)
const HIGH_TIER = /Adreno (6[0-9]{2}|7\d{2})|Mali-G(7[0-9]|8[0-9]|9[0-9])/i

// GPUs mid-range: 3D funciona mas com limitações (Adreno 4xx/5xx, Mali-G30-60, PowerVR)
const LOW_TIER = /Adreno [45]\d{2}|Mali-G[34567]\d|PowerVR/i

let cached: DeviceTier | null = null

export function detectDeviceTier(): DeviceTier {
  if (cached !== null) return cached

  const canvas = document.createElement('canvas')
  const gl =
    (canvas.getContext('webgl2') as WebGL2RenderingContext | null) ??
    (canvas.getContext('webgl') as WebGLRenderingContext | null)

  if (!gl) {
    cached = 'none'
    return cached
  }

  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
  const renderer = debugInfo
    ? (gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) as string)
    : ''

  if (HIGH_TIER.test(renderer)) {
    cached = 'high'
  } else if (LOW_TIER.test(renderer)) {
    cached = 'low'
  } else {
    // Desconhecido: tratar como low por precaução em tablets
    cached = 'low'
  }

  return cached
}
