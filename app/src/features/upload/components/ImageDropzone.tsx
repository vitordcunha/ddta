import { useRef, useState, type DragEvent } from 'react'
import { ImagePlus } from 'lucide-react'

interface ImageDropzoneProps {
  onFilesSelected: (files: FileList | File[]) => void
}

export function ImageDropzone({ onFilesSelected }: ImageDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    if (event.dataTransfer.files?.length) {
      onFilesSelected(event.dataTransfer.files)
    }
  }

  return (
    <div
      className={[
        'rounded-2xl border-2 border-dashed p-6 text-center transition md:p-10',
        isDragging
          ? 'border-primary-500 bg-primary-500/5 shadow-[0_0_0_1px_rgba(168,85,247,0.5)]'
          : 'border-neutral-700 bg-neutral-900/50',
      ].join(' ')}
      onDragEnter={(event) => {
        event.preventDefault()
        setIsDragging(true)
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        event.preventDefault()
        setIsDragging(false)
      }}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          inputRef.current?.click()
        }
      }}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        multiple
        accept=".jpg,.jpeg,.tif,.tiff,image/jpeg,image/tiff"
        onChange={(event) => {
          if (event.target.files?.length) {
            onFilesSelected(event.target.files)
            event.target.value = ''
          }
        }}
      />
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-neutral-700 bg-neutral-950">
        <ImagePlus className="h-6 w-6 text-primary-300" />
      </div>
      <p className="text-base font-semibold text-neutral-100 md:text-lg">Arraste as fotos aqui</p>
      <p className="mt-1 text-sm text-neutral-400">JPG, JPEG, TIF, TIFF - com metadados GPS (EXIF)</p>
      <p className="mt-4 text-xs text-neutral-500">Clique para selecionar arquivos</p>
    </div>
  )
}
