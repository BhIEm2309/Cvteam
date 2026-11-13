import { useRef, useState, type DragEvent } from 'react'
import { CloudUpload } from 'lucide-react'
import { MAX_FILE_SIZE_MB } from '@/shared/lib/validate-file'

interface UploadDropzoneProps {
  // Se llama con los archivos que el usuario arrastró o seleccionó.
  onFilesSelected: (files: File[]) => void
}

// Zona para arrastrar archivos o elegirlos con el explorador.
export function UploadDropzone({ onFilesSelected }: UploadDropzoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    // Sin preventDefault el navegador abriría el archivo en vez de soltarlo aquí.
    event.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave() {
    setIsDragging(false)
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragging(false)
    const files = Array.from(event.dataTransfer.files)
    if (files.length > 0) {
      onFilesSelected(files)
    }
  }

  function handleInputChange() {
    const input = fileInputRef.current
    if (input === null || input.files === null) {
      return
    }

    const files = Array.from(input.files)
    if (files.length > 0) {
      onFilesSelected(files)
    }

    // Se limpia para poder volver a elegir el mismo archivo.
    input.value = ''
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={
        isDragging
          ? 'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-primary bg-primary/10 px-6 py-12 text-center'
          : 'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-card/40 px-6 py-12 text-center'
      }
    >
      <div className="flex size-14 items-center justify-center rounded-full border border-border bg-secondary">
        <CloudUpload className="size-6 text-primary" />
      </div>
      <div>
        <p className="font-medium text-foreground">Arrastra tus archivos PDF aquí</p>
        <p className="text-sm text-muted-foreground">
          o{' '}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-primary underline underline-offset-4 hover:text-primary/80"
          >
            seleccionar archivos
          </button>
        </p>
      </div>
      <p className="text-xs text-muted-foreground">Solo PDF · Máximo {MAX_FILE_SIZE_MB} MB por archivo</p>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        multiple
        className="hidden"
        onChange={handleInputChange}
      />
    </div>
  )
}
