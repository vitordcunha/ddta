import { Button, Card } from '@/components/ui'

export function NewProjectPage() {
  return (
    <Card className="max-w-2xl space-y-4">
      <h2 className="text-lg font-medium">Novo Projeto</h2>
      <p className="text-sm text-neutral-400">Tela inicial da criação de projeto (mock da fase 1).</p>
      <div className="grid gap-3">
        <input className="input-base" placeholder="Nome do projeto" />
        <textarea className="textarea-base" placeholder="Descrição" />
      </div>
      <Button>Criar projeto</Button>
    </Card>
  )
}
