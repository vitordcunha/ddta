import { Button, Modal } from '@/components/ui'
import type { Project } from '@/types/project'

type DeleteProjectModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: Project | null
  onConfirm: () => void
}

export function DeleteProjectModal({ open, onOpenChange, project, onConfirm }: DeleteProjectModalProps) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Excluir projeto">
      <div className="space-y-4">
        <p className="text-sm text-neutral-300">
          Tem certeza que deseja excluir <span className="font-medium text-neutral-100">{project?.name ?? 'este projeto'}</span>?
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              onConfirm()
              onOpenChange(false)
            }}
          >
            Excluir
          </Button>
        </div>
      </div>
    </Modal>
  )
}
