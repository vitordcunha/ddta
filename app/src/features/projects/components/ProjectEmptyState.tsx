import { FolderKanban } from 'lucide-react'
import { Button, Card } from '@/components/ui'

type ProjectEmptyStateProps = {
  onCreate: () => void
}

export function ProjectEmptyState({ onCreate }: ProjectEmptyStateProps) {
  return (
    <Card className="flex flex-col items-center gap-3 py-10 text-center">
      <FolderKanban className="size-10 text-primary-300" />
      <h3 className="text-lg font-medium">Nenhum projeto criado</h3>
      <p className="max-w-md text-sm text-neutral-400">Comece criando seu primeiro projeto para planejar voos e acompanhar resultados.</p>
      <Button onClick={onCreate}>Criar primeiro projeto</Button>
    </Card>
  )
}
