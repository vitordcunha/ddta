import type { ReactNode } from 'react'

interface ResultsLayoutProps {
  map: ReactNode
  panel: ReactNode
}

export function ResultsLayout({ map, panel }: ResultsLayoutProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
      <section>{map}</section>
      <aside className="space-y-4">{panel}</aside>
    </div>
  )
}
