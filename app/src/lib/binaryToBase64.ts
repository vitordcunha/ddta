/** Codifica bytes binários em Base64 (KMZ) de forma segura para ficheiros grandes. */
export function binaryToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const chunk = 0x4000
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunk) {
    const end = Math.min(i + chunk, bytes.length)
    for (let j = i; j < end; j++) {
      binary += String.fromCharCode(bytes[j]!)
    }
  }
  return btoa(binary)
}
