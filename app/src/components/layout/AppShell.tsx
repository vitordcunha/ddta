import { Outlet, useLocation } from 'react-router-dom'
import { BottomNav } from '@/components/layout/BottomNav'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'

const titleMap: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/projects/new': 'Novo Projeto',
  '/settings': 'Configurações',
}

export function AppShell() {
  const location = useLocation()
  const dynamicTitle = (() => {
    if (location.pathname.endsWith('/plan')) return 'Planejador de Voo'
    if (location.pathname.endsWith('/upload')) return 'Upload'
    if (location.pathname.endsWith('/results')) return 'Resultados'
    return null
  })()
  const title = dynamicTitle ?? titleMap[location.pathname] ?? 'Projeto'

  return (
    <div className="flex min-h-screen bg-neutral-900 text-neutral-100">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <TopBar title={title} />
        <main className="flex-1 p-4 pb-20 md:p-6 md:pb-6">
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
