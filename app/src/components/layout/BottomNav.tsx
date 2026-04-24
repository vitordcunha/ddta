import { LayoutDashboard, FolderKanban, PlusSquare, Settings } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'

const items = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/projects/1', label: 'Projetos', icon: FolderKanban },
  { to: '/projects/new', label: 'Novo', icon: PlusSquare },
  { to: '/settings', label: 'Config', icon: Settings },
]

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-center justify-around border-t border-neutral-800 bg-neutral-900 px-2 pb-[max(0.5rem,var(--safe-area-bottom))] md:hidden">
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) => cn('flex flex-col items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors', isActive ? 'text-primary-300' : 'text-neutral-500')}
        >
          <Icon className="size-5" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
