import { Button } from '@/components/ui/Button'

interface UploadActionBarProps {
  total: number
  disabled: boolean
  isUploading: boolean
  onUpload: () => void
  onClear: () => void
}

export function UploadActionBar({ total, disabled, isUploading, onUpload, onClear }: UploadActionBarProps) {
  return (
    <div className="fixed inset-x-0 bottom-16 z-20 border-t border-neutral-800 bg-neutral-950/95 p-3 backdrop-blur md:static md:inset-auto md:bottom-auto md:border-0 md:bg-transparent md:p-0">
      <div className="mx-auto flex max-w-5xl gap-2">
        <Button className="flex-1" onClick={onUpload} disabled={disabled}>
          {isUploading ? 'Upload em andamento...' : `Iniciar upload de ${total} imagens`}
        </Button>
        <Button variant="secondary" onClick={onClear} disabled={isUploading || !total}>
          Limpar lista
        </Button>
      </div>
    </div>
  )
}
