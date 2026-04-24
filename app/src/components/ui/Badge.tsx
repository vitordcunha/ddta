import { cva, type VariantProps } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const badgeVariants = cva('inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium', {
  variants: {
    variant: {
      created: 'border-neutral-700 bg-neutral-900 text-neutral-300',
      uploading: 'border-primary-500/40 bg-primary-500/10 text-primary-300',
      processing: 'animate-pulse-slow border-warning-500/40 bg-warning-500/10 text-warning-300',
      completed: 'border-accent-500/40 bg-accent-500/10 text-accent-300',
      failed: 'border-danger-500/40 bg-danger-500/10 text-danger-300',
      info: 'border-primary-500/40 bg-primary-500/10 text-primary-300',
      success: 'border-accent-500/40 bg-accent-500/10 text-accent-300',
      warning: 'border-warning-500/40 bg-warning-500/10 text-warning-300',
      error: 'border-danger-500/40 bg-danger-500/10 text-danger-300',
    },
  },
  defaultVariants: {
    variant: 'info',
  },
})

type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
