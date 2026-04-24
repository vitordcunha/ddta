import { cn } from '@/lib/utils'

type SpinnerProps = {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function Spinner({ size = 'md', className }: SpinnerProps) {
  const sizeClass = size === 'sm' ? 'size-4' : size === 'lg' ? 'size-6' : 'size-5'

  return (
    <svg className={cn('animate-spin text-current', sizeClass, className)} fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}
