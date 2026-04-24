import { Button, Card } from '@/components/ui'

export function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center p-4">
      <Card className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-medium">Entrar</h1>
        <input className="input-base" placeholder="Email" />
        <input className="input-base" placeholder="Senha" type="password" />
        <Button className="w-full">Acessar</Button>
      </Card>
    </main>
  )
}
