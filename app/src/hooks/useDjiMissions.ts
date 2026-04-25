import { useCallback } from 'react'
import { Capacitor } from '@capacitor/core'
import {
  DjiMission,
  type DjiMissionApp,
  type DjiMissionListItem,
} from '@/native/djiMission'
import { binaryToBase64 } from '@/lib/binaryToBase64'

const STORAGE_GRANTED_KEY = 'dronemapper:dji_all_files_access_granted'

function setStoredGranted(value: boolean) {
  try {
    if (value) localStorage.setItem(STORAGE_GRANTED_KEY, '1')
    else localStorage.removeItem(STORAGE_GRANTED_KEY)
  } catch {
    /* ignore */
  }
}

export type PushKmzResult =
  | { ok: true; path: string }
  | { ok: false; message: string }

export function useDjiMissions() {
  const isAvailable = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isAvailable) return false
    try {
      await DjiMission.requestAllFilesAccess()
      const { granted } = await DjiMission.checkAllFilesAccess()
      setStoredGranted(granted)
      return granted
    } catch {
      setStoredGranted(false)
      return false
    }
  }, [isAvailable])

  const refreshPermission = useCallback(async (): Promise<boolean> => {
    if (!isAvailable) return false
    try {
      const { granted } = await DjiMission.checkAllFilesAccess()
      setStoredGranted(granted)
      return granted
    } catch {
      return false
    }
  }, [isAvailable])

  const listMissions = useCallback(async (): Promise<DjiMissionListItem[]> => {
    if (!isAvailable) return []
    const res = await DjiMission.listMissions()
    return res.missions ?? []
  }, [isAvailable])

  const pushKmzToController = useCallback(
    async (
      kmzBytes: ArrayBuffer,
      options?: { uuid?: string; app?: DjiMissionApp },
    ): Promise<PushKmzResult> => {
      if (!isAvailable) {
        return { ok: false, message: 'Disponível apenas no Android nativo.' }
      }
      try {
        const kmzBase64 = binaryToBase64(kmzBytes)
        const out = await DjiMission.replaceMission({
          kmzBase64,
          uuid: options?.uuid,
          app: options?.app ?? 'fly',
        })
        if (out.ok) return { ok: true, path: out.path }
        return { ok: false, message: 'Resposta inesperada do plugin nativo.' }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        return { ok: false, message: msg || 'Falha ao gravar o KMZ.' }
      }
    },
    [isAvailable],
  )

  return {
    isAvailable,
    requestPermission,
    refreshPermission,
    listMissions,
    pushKmzToController,
  }
}
