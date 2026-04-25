import { registerPlugin } from '@capacitor/core'

export type DjiMissionApp = 'fly' | 'pilot2'

export type DjiMissionListItem = {
  name: string
  path: string
  app: DjiMissionApp
  modifiedMs: number
}

export type DjiMissionListResult = {
  missions: DjiMissionListItem[]
  storageAccess: boolean
}

export type DjiMissionReplaceResult = {
  ok: boolean
  path: string
}

export interface DjiMissionPluginContract {
  checkAllFilesAccess(): Promise<{ granted: boolean }>
  requestAllFilesAccess(): Promise<{ granted: boolean }>
  listMissions(): Promise<DjiMissionListResult>
  replaceMission(options: {
    kmzBase64: string
    uuid?: string
    app?: DjiMissionApp
  }): Promise<DjiMissionReplaceResult>
}

export const DjiMission = registerPlugin<DjiMissionPluginContract>('DjiMission')
