import type { ReactNode } from 'react'
import { Menu } from 'lucide-react'

type TopBarProps = {
  title: string
  actions?: ReactNode
}

export function TopBar({ title, actions }: TopBarProps) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-neutral-800 bg-neutral-900/90 px-4 backdrop-blur md:px-6" style={{ paddingTop: 'var(--safe-area-top)' }}>
      <div className="flex items-center gap-3">
        <button type="button" aria-label="Abrir menu" className="rounded-md border border-transparent p-1 text-neutral-400 hover:border-neutral-800 hover:bg-neutral-950 hover:text-neutral-100 lg:hidden">
          <Menu className="size-5" />
        </button>
        <h1 className="text-base font-medium md:text-lg">{title}</h1>
      </div>
      {actions}
    </header>
  )
}
