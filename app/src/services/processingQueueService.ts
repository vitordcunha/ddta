import { http } from '@/services/http'

export type CeleryTaskItem = {
  worker: string
  bucket: string
  task_id: string | null
  task_name: string | null
  args_preview: string | null
}

export type OdmTaskItem = {
  uuid: string
  status: string
  progress: number
  linked_project_id: string | null
  pipeline: string | null
}

export type ProjectPipelineItem = {
  id: string
  name: string
  status: string
  progress: number
  preview_status: string | null
  preview_progress: number
  celery_main_task_id: string | null
  celery_preview_task_id: string | null
  odm_main_task_id: string | null
  odm_preview_task_id: string | null
}

export type ProcessingMonitorSnapshot = {
  generated_at: string
  celery_workers_reached: boolean
  celery_error: string | null
  celery_tasks: CeleryTaskItem[]
  odm_node_reachable: boolean
  odm_error: string | null
  odm_host: string
  odm_port: number
  odm_tasks: OdmTaskItem[]
  pipeline_projects: ProjectPipelineItem[]
}

export const processingQueueService = {
  async getSnapshot(): Promise<ProcessingMonitorSnapshot> {
    const { data } = await http.get<ProcessingMonitorSnapshot>('/processing-queue')
    return data
  },

  async revokeCeleryTask(taskId: string): Promise<void> {
    await http.post('/processing-queue/celery/revoke', { task_id: taskId })
  },

  async cancelOdmTask(taskUuid: string): Promise<void> {
    await http.post('/processing-queue/odm/cancel', { task_uuid: taskUuid })
  },
}
