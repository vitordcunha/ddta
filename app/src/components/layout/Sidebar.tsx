import { LayoutDashboard, FolderKanban, PlusSquare, Settings } from 'lucide-react'
import { NavLink } from 'react-router-dom'

const items = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/projects/1', label: 'Projetos', icon: FolderKanban },
  { to: '/projects/new', label: 'Novo Projeto', icon: PlusSquare },
  { to: '/settings', label: 'Configurações', icon: Settings },
]

export function Sidebar() {
  return (
    <aside className="hidden h-screen w-16 flex-col border-r border-neutral-800 bg-neutral-900 p-2 md:flex lg:w-60">
      <div className="mb-4 px-2 py-3 text-xs font-medium uppercase tracking-[1.2px] text-neutral-500 lg:text-sm">DroneMapper</div>
      <nav className="space-y-1">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              [
                'flex items-center gap-3 rounded-md border-l-2 px-2 py-2 text-sm transition-colors',
                isActive
                  ? 'border-primary-500 bg-primary-500/10 text-primary-300'
                  : 'border-transparent text-neutral-400 hover:bg-neutral-950 hover:text-neutral-200',
              ].join(' ')
            }
          >
            <Icon className="size-5 shrink-0" />
            <span className="hidden lg:inline">{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
