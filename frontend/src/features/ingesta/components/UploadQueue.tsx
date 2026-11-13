import { CheckCircle2, FileText, Loader2, XCircle } from 'lucide-react'
import { Badge } from '@/shared/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Progress } from '@/shared/ui/progress'
import { formatBytes } from '@/shared/lib/format'

export type UploadStatus = 'uploading' | 'done' | 'error'

// Un archivo que se está subiendo (o se subió) en esta sesión.
export interface UploadItem {
  id: string
  fileName: string
  sizeBytes: number
  progress: number
  status: UploadStatus
  errorMessage?: string
}

interface UploadQueueProps {
  uploads: UploadItem[]
}

// Lista de archivos subidos en esta sesión, con su avance y resultado.
export function UploadQueue({ uploads }: UploadQueueProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Archivos de esta sesión</CardTitle>
        <Badge variant="secondary">{uploads.length} archivos</Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-1 p-0">
        {uploads.length === 0 && (
          <p className="px-6 pb-6 text-sm text-muted-foreground">Todavía no has subido archivos en esta sesión.</p>
        )}

        {uploads.map((upload) => (
          <div key={upload.id} className="flex items-start gap-3 border-t border-border px-6 py-4">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary">
              <FileText className="size-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <p className="truncate font-mono text-sm text-foreground">{upload.fileName}</p>
                <UploadStatusBadge status={upload.status} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatBytes(upload.sizeBytes)} · {upload.progress}%
              </p>
              <UploadProgressBar status={upload.status} progress={upload.progress} />
              {upload.errorMessage && <p className="mt-2 text-xs text-destructive">{upload.errorMessage}</p>}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function UploadStatusBadge({ status }: { status: UploadStatus }) {
  if (status === 'uploading') {
    return (
      <Badge variant="outline" className="border-primary/40 text-primary">
        <Loader2 className="animate-spin" /> Subiendo
      </Badge>
    )
  }

  if (status === 'done') {
    return (
      <Badge variant="outline" className="border-emerald-400/40 text-emerald-400">
        <CheckCircle2 /> Guardado
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className="border-destructive/40 text-destructive">
      <XCircle /> Error
    </Badge>
  )
}

// Barra de avance con el color según el estado.
function UploadProgressBar({ status, progress }: { status: UploadStatus; progress: number }) {
  let barColor = 'bg-primary'
  if (status === 'done') {
    barColor = 'bg-emerald-400'
  }
  if (status === 'error') {
    barColor = 'bg-destructive'
  }

  return <Progress value={progress} className="mt-2 h-1.5 bg-secondary" indicatorClassName={barColor} />
}
