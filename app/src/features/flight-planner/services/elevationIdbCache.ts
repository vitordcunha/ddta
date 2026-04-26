import { del, get, set } from 'idb-keyval'

const ELEV_TTL_MS = 7 * 24 * 60 * 60 * 1000

type IdbEntry = { v: number; t: number }

/** Chave alinhada ao plano: `elev:${lat.toFixed(4)},${lng.toFixed(4)}` (TTL 7 dias) */
export function idbElevationKeyForPoint(lat: number, lng: number): string {
  return `elev:${lat.toFixed(4)},${lng.toFixed(4)}`
}

export async function idbGetElevationM(key: string): Promise<number | undefined> {
  if (typeof indexedDB === 'undefined') return undefined
  const e = await get<IdbEntry>(key)
  if (e == null) return undefined
  if (Date.now() - e.t > ELEV_TTL_MS) {
    void del(key)
    return undefined
  }
  return e.v
}

export async function idbSetElevationM(key: string, meters: number): Promise<void> {
  if (typeof indexedDB === 'undefined') return
  await set(key, { v: meters, t: Date.now() } satisfies IdbEntry)
}
