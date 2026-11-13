// DATOS DE EJEMPLO para la página Ingesta. Personas y documentos ficticios.
// Se usan solo según las reglas del modo de datos (ver src/shared/lib/load-data.ts).
// Las subidas simuladas se guardan en esta lista, en memoria: se pierden al recargar la página.
import type { DocumentItem, DocumentType } from './types'

const mockDocuments: DocumentItem[] = [
  {
    id: 'ejemplo-4',
    title: 'Perfil de cargo - Técnico senior',
    type: 'JOB_PROFILE',
    fileName: 'Perfil de cargo - Técnico senior.pdf',
    sizeBytes: 182_400,
    versionNumber: 1,
    createdAt: '2026-11-10T15:20:00.000Z',
    analysisStatus: 'PENDING_ANALYSIS',
  },
  {
    id: 'ejemplo-3',
    title: 'CV Diego Ramírez',
    type: 'CV',
    fileName: 'CV Diego Ramírez.pdf',
    sizeBytes: 245_760,
    versionNumber: 1,
    createdAt: '2026-11-10T14:05:00.000Z',
    analysisStatus: 'PENDING_ANALYSIS',
  },
  {
    id: 'ejemplo-2',
    title: 'CV Andrea Solís',
    type: 'CV',
    fileName: 'CV Andrea Solís.pdf',
    sizeBytes: 311_296,
    versionNumber: 1,
    createdAt: '2026-11-09T18:42:00.000Z',
    analysisStatus: 'PENDING_ANALYSIS',
  },
  {
    id: 'ejemplo-1',
    title: 'CV Valentina Torres',
    type: 'CV',
    fileName: 'CV Valentina Torres.pdf',
    sizeBytes: 198_656,
    versionNumber: 1,
    createdAt: '2026-11-09T12:10:00.000Z',
    analysisStatus: 'PENDING_ANALYSIS',
  },
]

// Copia de la lista, para que nadie la modifique desde afuera.
export function getMockDocuments(): DocumentItem[] {
  return [...mockDocuments]
}

// Simula la subida de un archivo: avanza el progreso y agrega el documento al inicio de la lista,
// igual que la API (ordena por fecha de carga, la más reciente primero).
export function simulateUpload(
  file: File,
  type: DocumentType,
  onProgress: (percent: number) => void,
): Promise<DocumentItem> {
  return new Promise((resolve) => {
    let percent = 0

    const timer = setInterval(() => {
      percent = Math.min(percent + 20, 100)
      onProgress(percent)

      if (percent === 100) {
        clearInterval(timer)
        const title = file.name.replace(/\.pdf$/i, '').trim() || 'Documento sin nombre'
        const document: DocumentItem = {
          id: `simulado-${crypto.randomUUID()}`,
          title: title.slice(0, 200),
          type: type,
          fileName: file.name,
          sizeBytes: file.size,
          versionNumber: 1,
          createdAt: new Date().toISOString(),
          analysisStatus: 'PENDING_ANALYSIS',
        }
        mockDocuments.unshift(document)
        resolve(document)
      }
    }, 150)
  })
}
