import { useState } from 'react'
import { Button, Modal } from '@/components/ui'
import type { Project } from '@/types/project'

type CreateProjectModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: { name: string; description: string }) => void
  project?: Project | null
}

export function CreateProjectModal({ open, onOpenChange, onSubmit, project }: CreateProjectModalProps) {
  const [name, setName] = useState(project?.name ?? '')
  const [description, setDescription] = useState(project?.description ?? '')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = () => {
    const trimmedName = name.trim()
    const trimmedDescription = description.trim()

    if (!trimmedName) {
      setError('Nome do projeto e obrigatorio.')
      return
    }
    if (trimmedName.length > 100) {
      setError('Nome deve ter ate 100 caracteres.')
      return
    }
    if (trimmedDescription.length > 500) {
      setError('Descricao deve ter ate 500 caracteres.')
      return
    }

    onSubmit({ name: trimmedName, description: trimmedDescription })
    onOpenChange(false)
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={project ? 'Editar projeto' : 'Criar projeto'}>
      <div className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="project-name" className="text-sm text-neutral-300">
            Nome
          </label>
          <input
            id="project-name"
            maxLength={100}
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="input-base"
            placeholder="Ex.: Fazenda Santa Luzia"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="project-description" className="text-sm text-neutral-300">
            Descricao
          </label>
          <textarea
            id="project-description"
            maxLength={500}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="textarea-base"
            placeholder="Detalhes opcionais do projeto"
          />
        </div>
        {error ? <p className="text-sm text-danger-300">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit}>{project ? 'Salvar' : 'Criar'}</Button>
        </div>
      </div>
    </Modal>
  )
}
