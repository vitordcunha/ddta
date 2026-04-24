import { useLocalStorage } from '@/hooks/useLocalStorage'

const DEFAULT_WORKSPACE_ID = 'default'

type AppContextValue = {
  workspaceId: string
  setWorkspaceId: (workspaceId: string) => void
}

export function useAppContext(): AppContextValue {
  const [workspaceId, setWorkspaceId] = useLocalStorage<string>('app:workspace-id', DEFAULT_WORKSPACE_ID)

  return { workspaceId, setWorkspaceId }
}

