import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type ModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children: ReactNode
}

export function Modal({ open, onOpenChange, title, children }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-neutral-800 bg-neutral-900 p-5 animate-fade-up',
          )}
        >
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="text-lg font-medium text-neutral-100">{title}</Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" aria-label="Fechar" className="rounded-md border border-transparent p-1 text-neutral-400 hover:border-neutral-800 hover:bg-neutral-950 hover:text-neutral-100">
                <X className="size-4" />
              </button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
