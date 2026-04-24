import { useMemo, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Card, CardBody, CardHeader, Button } from '@/components/ui'
import { useAppContext } from '@/hooks/useAppContext'
import { useLocalStorage } from '@/hooks/useLocalStorage'

type ThemeMode = 'system' | 'dark' | 'light'
type DistanceUnit = 'm' | 'ft'

type UserPreferences = {
  theme: ThemeMode
  distanceUnit: DistanceUnit
  openWeatherApiKey: string
}

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'system',
  distanceUnit: 'm',
  openWeatherApiKey: '',
}

export function SettingsPage() {
  const { workspaceId, setWorkspaceId } = useAppContext()
  const [preferences, setPreferences] = useLocalStorage<UserPreferences>('app:user-preferences', DEFAULT_PREFERENCES)
  const [showWeatherKey, setShowWeatherKey] = useState(false)

  const sanitizedWorkspaceId = useMemo(() => workspaceId.trim() || 'default', [workspaceId])

  const handleWorkspaceBlur = () => {
    if (sanitizedWorkspaceId !== workspaceId) {
      setWorkspaceId(sanitizedWorkspaceId)
    }
  }

  const updatePreferences = <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
    setPreferences((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-neutral-100">Contexto da Aplicação</h2>
          <p className="text-sm text-neutral-400">Modo single-tenant sem autenticação, alinhado ao backend atual.</p>
        </CardHeader>
        <CardBody className="space-y-3">
          <label className="block text-sm font-medium text-neutral-300" htmlFor="workspaceId">
            Workspace ID
          </label>
          <input
            id="workspaceId"
            className="input-base"
            value={workspaceId}
            onChange={(event) => setWorkspaceId(event.target.value)}
            onBlur={handleWorkspaceBlur}
            placeholder="default"
          />
          <p className="text-xs text-neutral-500">Valor usado como contexto de requisição. Padrão recomendado: `default`.</p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-neutral-100">Preferências</h2>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-neutral-300">Tema</label>
            <div className="flex flex-wrap gap-2">
              <Button variant={preferences.theme === 'system' ? 'primary' : 'outline'} onClick={() => updatePreferences('theme', 'system')}>
                Sistema
              </Button>
              <Button variant={preferences.theme === 'dark' ? 'primary' : 'outline'} onClick={() => updatePreferences('theme', 'dark')}>
                Escuro
              </Button>
              <Button variant={preferences.theme === 'light' ? 'primary' : 'outline'} onClick={() => updatePreferences('theme', 'light')}>
                Claro
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-neutral-300">Unidade de distância</label>
            <div className="flex flex-wrap gap-2">
              <Button variant={preferences.distanceUnit === 'm' ? 'primary' : 'outline'} onClick={() => updatePreferences('distanceUnit', 'm')}>
                Metros (m)
              </Button>
              <Button variant={preferences.distanceUnit === 'ft' ? 'primary' : 'outline'} onClick={() => updatePreferences('distanceUnit', 'ft')}>
                Pés (ft)
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-neutral-300" htmlFor="weather-key">
              Chave da API OpenWeatherMap
            </label>
            <div className="flex items-center gap-2">
              <input
                id="weather-key"
                className="input-base"
                type={showWeatherKey ? 'text' : 'password'}
                value={preferences.openWeatherApiKey}
                onChange={(event) => updatePreferences('openWeatherApiKey', event.target.value)}
                placeholder="Cole sua chave"
              />
              <Button type="button" variant="outline" onClick={() => setShowWeatherKey((prev) => !prev)} aria-label={showWeatherKey ? 'Ocultar chave' : 'Mostrar chave'}>
                {showWeatherKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-neutral-100">Sobre</h2>
        </CardHeader>
        <CardBody className="space-y-1 text-sm text-neutral-400">
          <p>DroneMapper Frontend</p>
          <p>Versao: 0.1.0</p>
          <p>Persistencia local de configuracoes ativa.</p>
        </CardBody>
      </Card>
    </section>
  )
}
