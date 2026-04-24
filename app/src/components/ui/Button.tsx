import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/Spinner'

const buttonVariants = cva(
  'inline-flex items-center justify-center font-medium transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'rounded-full border border-neutral-100 bg-neutral-950 text-neutral-100 hover:border-primary-500 hover:text-primary-300',
        secondary: 'rounded-full border border-neutral-800 bg-neutral-950 text-neutral-100 hover:border-neutral-700',
        ghost: 'rounded-md border border-transparent bg-transparent text-neutral-100 hover:border-neutral-800 hover:bg-neutral-900',
        danger: 'bg-danger-600 text-white hover:bg-danger-500',
        outline: 'rounded-md border border-neutral-800 bg-transparent text-neutral-100 hover:border-neutral-700 hover:bg-neutral-900',
      },
      size: {
        sm: 'h-9 px-3 text-sm',
        md: 'h-10 px-5 text-sm',
        lg: 'h-12 px-8 text-base',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
)

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    loading?: boolean
  }

export function Button({ className, variant, size, loading, children, disabled, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonVariants({ variant, size }), className)} disabled={disabled || loading} {...props}>
      {loading ? <Spinner size="sm" className="mr-2" /> : null}
      {children}
    </button>
  )
}
