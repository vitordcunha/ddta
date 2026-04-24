import { Button, Card } from '@/components/ui'

export function RegisterPage() {
  return (
    <main className="grid min-h-screen place-items-center p-4">
      <Card className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-medium">Criar conta</h1>
        <input className="input-base" placeholder="Nome" />
        <input className="input-base" placeholder="Email" />
        <input className="input-base" placeholder="Senha" type="password" />
        <Button className="w-full">Cadastrar</Button>
      </Card>
    </main>
  )
}
