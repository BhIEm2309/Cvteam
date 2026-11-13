import { Link } from 'react-router'
import { ExternalLink, Loader2, RotateCcw } from 'lucide-react'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { ANALYSIS_STATUS_LABELS, DOCUMENT_TYPE_LABELS } from '../constants'
import type { DocumentItem } from '../types'
import { formatBytes, formatDateTime } from '@/shared/lib/format'

interface DocumentsTableProps {
  documents: DocumentItem[] | undefined
  isLoading: boolean
  errorMessage: string | null
  // true si la lista son datos de ejemplo: no hay archivo real que abrir.
  isSample: boolean
  // Documento cuyo análisis se está pidiendo de nuevo (para mostrar el botón ocupado).
  retryingId: string | null
  onRetry: (documentId: string) => void
}

// Tabla con los documentos guardados en la base de datos (GET /api/documents).
export function DocumentsTable({ documents, isLoading, errorMessage, isSample, retryingId, onRetry }: DocumentsTableProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Documentos cargados</CardTitle>
        {documents && <Badge variant="secondary">{documents.length} documentos</Badge>}
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-sm text-muted-foreground">Cargando documentos...</p>}

        {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}

        {documents && documents.length === 0 && (
          <p className="text-sm text-muted-foreground">Aún no hay documentos. Sube el primero arriba.</p>
        )}

        {documents && documents.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Tamaño</TableHead>
                <TableHead>Fecha de carga</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Archivo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((document) => (
                <TableRow key={document.id}>
                  <TableCell>
                    <p className="font-medium text-foreground">{document.title}</p>
                    <p className="text-xs text-muted-foreground">{document.fileName}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{DOCUMENT_TYPE_LABELS[document.type]}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatBytes(document.sizeBytes)}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDateTime(document.createdAt)}</TableCell>
                  <TableCell>
                    <AnalysisStatusCell
                      document={document}
                      fromApi={!isSample}
                      isRetrying={retryingId === document.id}
                      onRetry={onRetry}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    {isSample ? (
                      <Button variant="outline" size="sm" disabled title="Documento de ejemplo: no tiene archivo">
                        <ExternalLink /> Ver
                      </Button>
                    ) : (
                      // Abre el PDF en una pestaña nueva (GET /api/documents/:id/file).
                      <Button asChild variant="outline" size="sm">
                        <a href={`/api/documents/${document.id}/file`} target="_blank" rel="noreferrer">
                          <ExternalLink /> Ver
                        </a>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

interface AnalysisStatusCellProps {
  document: DocumentItem
  // true si el documento viene de la API (no es de ejemplo): se puede reintentar y revisar.
  fromApi: boolean
  isRetrying: boolean
  onRetry: (documentId: string) => void
}

// Estado del análisis con IA de un documento. Si falló, muestra el motivo y permite pedirlo de nuevo.
function AnalysisStatusCell({ document, fromApi, isRetrying, onRetry }: AnalysisStatusCellProps) {
  const status = ANALYSIS_STATUS_LABELS[document.analysisStatus]
  const working = document.analysisStatus === 'QUEUED' || document.analysisStatus === 'PROCESSING'

  return (
    <div className="flex max-w-xs flex-col items-start gap-1">
      <Badge variant="outline" className={status.className}>
        {working && <Loader2 className="animate-spin" />}
        {status.label}
      </Badge>

      {document.analysisStatus === 'COMPLETED' &&
        (fromApi ? (
          // Con la API real se puede abrir la revisión (los datos de ejemplo no se revisan).
          <Link to={`/ingesta/revision/${document.id}`} className="text-xs text-primary underline-offset-2 hover:underline">
            {document.pendingProposals === 0
              ? 'Revisado · ver competencias'
              : document.pendingProposals === 1
                ? 'Revisar 1 competencia propuesta'
                : `Revisar ${document.pendingProposals} competencias propuestas`}
          </Link>
        ) : (
          <span className="text-xs text-muted-foreground">
            {document.pendingProposals === 1
              ? '1 competencia propuesta por revisar'
              : `${document.pendingProposals} competencias propuestas por revisar`}
          </span>
        ))}

      {document.analysisStatus === 'FAILED' && (
        <>
          {document.analysisError && <span className="text-xs whitespace-normal text-red-300/90">{document.analysisError}</span>}
          {fromApi && document.type === 'CV' && (
            <Button variant="outline" size="sm" onClick={() => onRetry(document.id)} disabled={isRetrying}>
              {isRetrying ? <Loader2 className="animate-spin" /> : <RotateCcw />} Analizar de nuevo
            </Button>
          )}
        </>
      )}
    </div>
  )
}
