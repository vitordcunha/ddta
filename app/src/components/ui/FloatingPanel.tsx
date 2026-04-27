import type { ReactNode } from 'react'
import { useDeviceTier, maybeBackdropBlur } from '@/lib/deviceUtils'
import { cn } from '@/lib/utils'

type FloatingPanelProps = {
  title: string
  subtitle?: string
  children: ReactNode
  className?: string
  headerRight?: ReactNode
}

export function FloatingPanel({ title, subtitle, children, className, headerRight }: FloatingPanelProps) {
  const deviceTier = useDeviceTier()
  return (
    <div
      className={cn(
        'flex max-h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[#2e2e2e] text-left shadow-[0_0_0_1px_rgba(46,46,46,0.4)]',
        deviceTier === 'high'
          ? 'bg-[rgba(23,23,23,0.88)]'
          : 'bg-[rgba(26,26,26,0.97)]',
        maybeBackdropBlur(deviceTier, 'md'),
        deviceTier === 'high' && 'animate-fade-in',
        className,
      )}
    >
      <div className="shrink-0 border-b border-[#242424] px-4 py-3 pr-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-base leading-tight tracking-[-0.16px] text-[#fafafa]">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-sm text-[#898989]">{subtitle}</p> : null}
          </div>
          {headerRight ? <div className="shrink-0 pt-0.5">{headerRight}</div> : null}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 [scrollbar-gutter:stable]">{children}</div>
    </div>
  )
}
