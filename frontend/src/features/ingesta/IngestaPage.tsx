import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Info } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { UploadDropzone } from './components/UploadDropzone'
import { UploadQueue, type UploadItem } from './components/UploadQueue'
import { DocumentsTable } from './components/DocumentsTable'
import { IngestaSummary } from './components/IngestaSummary'
import { OrgChartImportCard } from './components/OrgChartImportCard'
import { PositionProfileImportCard } from './components/PositionProfileImportCard'
import { getDocuments, getExtractionSettings, requestExtraction, uploadDocument } from './api'
import { ANALYSIS_POLL_INTERVAL_MS, DOCUMENT_TYPE_LABELS } from './constants'
import type { DocumentType } from './types'
import { validatePdfFile } from '@/shared/lib/validate-file'
import { SampleDataNotice } from '@/shared/components/SampleDataNotice'
import { getSourceStatus, useReportSourceStatus } from '@/shared/lib/data-source'

// Página de carga de CVs y perfiles de cargo. Muestra el estado del análisis con IA de cada CV.
export function IngestaPage() {
  const queryClient = useQueryClient()
  const [documentType, setDocumentType] = useState<DocumentType>('CV')
  const [uploads, setUploads] = useState<UploadItem[]>([])

  // Lista de documentos guardados. TanStack Query la pide a la API (o a los datos de ejemplo, según el modo).
  const documentsQuery = useQuery({
    queryKey: ['documents'],
    queryFn: getDocuments,
    // Mientras algún CV esté en cola o analizándose, se vuelve a pedir la lista para ver cuándo termina.
    refetchInterval: (query) => {
      const loaded = query.state.data
      const working = loaded?.source === 'api' && loaded.data.some((d) => d.analysisStatus === 'QUEUED' || d.analysisStatus === 'PROCESSING')
      return working ? ANALYSIS_POLL_INTERVAL_MS : false
    },
  })
  useReportSourceStatus('/ingesta', getSourceStatus(documentsQuery))

  // Qué IA analiza los CVs. Mientras carga, o si falla, no se ofrece el modelo alternativo (solo "Analizar de nuevo").
  const settingsQuery = useQuery({ queryKey: ['extraction-settings'], queryFn: getExtractionSettings })
  const alternativeModel = settingsQuery.data?.data.alternativeModel ?? null

  // Pedir de nuevo el análisis de un CV que falló.
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const [retryError, setRetryError] = useState<string | null>(null)

  async function handleRetry(documentId: string, model?: string) {
    setRetryingId(documentId)
    setRetryError(null)
    try {
      await requestExtraction(documentId, model)
    } catch (error) {
      setRetryError(error instanceof Error ? error.message : 'No se pudo pedir el análisis del CV.')
    } finally {
      setRetryingId(null)
      // Se vuelve a pedir la lista: el CV aparece "En cola" y la lista se actualiza sola hasta que termine.
      queryClient.invalidateQueries({ queryKey: ['documents'] })
    }
  }

  // Cambia algunos datos de un archivo de la lista de subidas (por ejemplo, su avance).
  function updateUpload(uploadId: string, changes: Partial<UploadItem>) {
    setUploads((currentUploads) =>
      currentUploads.map((upload) => (upload.id === uploadId ? { ...upload, ...changes } : upload)),
    )
  }

  // Se llama cuando el usuario arrastra o selecciona archivos.
  function handleFilesSelected(files: File[]) {
    for (const file of files) {
      startUpload(file)
    }
  }

  async function startUpload(file: File) {
    const uploadId = crypto.randomUUID()
    const errorMessage = validatePdfFile(file)

    // 1. Si el archivo no es válido, se muestra el error sin enviarlo.
    if (errorMessage !== null) {
      const failedUpload: UploadItem = {
        id: uploadId,
        fileName: file.name,
        sizeBytes: file.size,
        progress: 0,
        status: 'error',
        errorMessage: errorMessage,
      }
      setUploads((currentUploads) => [failedUpload, ...currentUploads])
      return
    }

    // 2. Se agrega a la lista como "subiendo".
    const newUpload: UploadItem = {
      id: uploadId,
      fileName: file.name,
      sizeBytes: file.size,
      progress: 0,
      status: 'uploading',
    }
    setUploads((currentUploads) => [newUpload, ...currentUploads])

    // 3. Se envía a la API y se actualiza el avance.
    try {
      await uploadDocument(
        file,
        documentType,
        (percent) => updateUpload(uploadId, { progress: percent }),
        documentsQuery.data?.source,
      )
      updateUpload(uploadId, { status: 'done', progress: 100 })

      // 4. Se vuelve a pedir la lista para que aparezca el documento nuevo.
      queryClient.invalidateQueries({ queryKey: ['documents'] })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo subir el archivo.'
      updateUpload(uploadId, { status: 'error', errorMessage: message })
    }
  }

  return (
    <div>
      <PageHeader title="Carga de CVs" description="Sube CVs y perfiles de cargo para su análisis." />

      {documentsQuery.data?.source === 'mock' && <SampleDataNotice reason={documentsQuery.data.reason} simulatesWrites />}

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        {/* min-w-0: permite que la columna se achique; si no, la tabla la estira y la página se sale de la pantalla. */}
        <div className="flex min-w-0 flex-col gap-6">
          {/* Tipo de documento que se va a subir */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <span className="text-sm text-muted-foreground">Tipo de documento:</span>
            <Select value={documentType} onValueChange={(value) => setDocumentType(value as DocumentType)}>
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CV">{DOCUMENT_TYPE_LABELS.CV}</SelectItem>
                <SelectItem value="JOB_PROFILE">{DOCUMENT_TYPE_LABELS.JOB_PROFILE}</SelectItem>
                <SelectItem value="SUPPORTING">{DOCUMENT_TYPE_LABELS.SUPPORTING}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <UploadDropzone onFilesSelected={handleFilesSelected} />

          <UploadQueue uploads={uploads} />

          {retryError && <p className="text-sm text-destructive">{retryError}</p>}

          <DocumentsTable
            documents={documentsQuery.data?.data}
            isLoading={documentsQuery.isLoading}
            errorMessage={documentsQuery.error ? documentsQuery.error.message : null}
            isSample={documentsQuery.data?.source === 'mock'}
            retryingId={retryingId}
            alternativeModel={alternativeModel}
            onRetry={handleRetry}
          />

          <OrgChartImportCard />

          <PositionProfileImportCard />

          <div className="flex items-start gap-2 rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0 text-primary" />
            <p>
              Al subir un CV, la IA propone sus competencias <strong className="text-foreground">técnicas y blandas</strong>,
              cada una con el fragmento del CV que la respalda. Son <strong className="text-foreground">propuestas</strong>:
              no cambian ningún dato hasta que una persona las revise y las confirme (enlace "por revisar" de cada CV).
            </p>
          </div>
        </div>

        <IngestaSummary documents={documentsQuery.data?.data ?? []} />
      </div>
    </div>
  )
}
