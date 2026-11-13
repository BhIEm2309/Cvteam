import { ExternalLink } from 'lucide-react'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { DOCUMENT_TYPE_LABELS } from '../constants'
import type { DocumentItem } from '../types'
import { formatBytes, formatDateTime } from '@/shared/lib/format'

interface DocumentsTableProps {
  documents: DocumentItem[] | undefined
  isLoading: boolean
  errorMessage: string | null
  // true si la lista son datos de ejemplo: no hay archivo real que abrir.
  isSample: boolean
}

// Tabla con los documentos guardados en la base de datos (GET /api/documents).
export function DocumentsTable({ documents, isLoading, errorMessage, isSample }: DocumentsTableProps) {
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
                    <Badge variant="outline" className="border-amber-400/40 text-amber-300">
                      Pendiente de análisis
                    </Badge>
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
