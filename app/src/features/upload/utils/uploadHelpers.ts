export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / Math.pow(1024, index)
  const digits = index === 0 ? 0 : value < 10 ? 1 : 0

  return `${value.toFixed(digits)} ${units[index]}`
}

export function chunkFile(file: File, chunkSize: number): Blob[] {
  if (chunkSize <= 0) return [file]

  const chunks: Blob[] = []
  let offset = 0

  while (offset < file.size) {
    chunks.push(file.slice(offset, offset + chunkSize))
    offset += chunkSize
  }

  return chunks
}

export function generateFileId(): string {
  return crypto.randomUUID()
}

export function estimateUploadTime(totalBytes: number, speedKbps: number): string {
  if (speedKbps <= 0 || totalBytes <= 0) return 'estimando...'

  const totalSeconds = Math.ceil(totalBytes / (speedKbps * 1024))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  if (minutes <= 0) return `${seconds}s`
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`
}
