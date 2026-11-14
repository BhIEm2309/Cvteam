// DATOS DE EJEMPLO para la página Ingesta. Personas y documentos ficticios.
// Se usan solo según las reglas del modo de datos (ver src/shared/lib/load-data.ts).
// Las subidas simuladas se guardan en esta lista, en memoria: se pierden al recargar la página.
import type { DocumentItem, DocumentType } from './types'

// Compresores del Sur (empresa ficticia) según el diseño de Figma: 47 CVs cargados.
// Los nombres se arman combinando listas, para no escribir 47 registros a mano. Personas ficticias.
// El diseño también muestra "43 procesados, 4 con error, 312 habilidades": 4 CVs quedan con error y los
// 43 analizados suman 312 competencias propuestas (7 cada uno y 1 más en los 11 primeros).
const MOCK_CV_COUNT = 47
const MOCK_FAILED_COUNT = 4
const MOCK_PROPOSALS_TOTAL = 312
const MOCK_FAILED_MESSAGE =
  'El PDF no tiene texto legible (probablemente es una imagen escaneada). Sube una versión con texto seleccionable.'

const FIRST_NAMES = [
  'Valentina', 'Diego', 'Andrea', 'Carlos', 'Javiera', 'Matías', 'Camila', 'Felipe', 'Constanza', 'Tomás',
  'Fernanda', 'Ignacio', 'Daniela', 'Sebastián', 'Catalina', 'Nicolás', 'Francisca', 'Benjamín', 'Antonia',
  'Cristóbal', 'Paula', 'Joaquín', 'Isidora', 'Vicente',
]
const LAST_NAMES = [
  'Torres', 'Ramírez', 'Solís', 'Medina', 'Rojas', 'Araya', 'Castillo', 'Pizarro', 'Contreras', 'Vega',
  'Cortés', 'Álvarez', 'Fuentes', 'Carvajal', 'Olivares', 'Tapia', 'Muñoz', 'Gallardo', 'Bravo',
]

function buildMockCvs(): DocumentItem[] {
  const cvs: DocumentItem[] = []
  // Fechas desde el 13-11-2026 hacia atrás, cada 3 horas: la más reciente queda primera (como en la API).
  const newest = Date.UTC(2026, 10, 13, 12, 0)

  const analyzedCount = MOCK_CV_COUNT - MOCK_FAILED_COUNT
  const basePerCv = Math.floor(MOCK_PROPOSALS_TOTAL / analyzedCount)
  const extra = MOCK_PROPOSALS_TOTAL - basePerCv * analyzedCount

  for (let index = 0; index < MOCK_CV_COUNT; index++) {
    // Los CVs con error se reparten en la lista (posiciones 5, 17, 29 y 41).
    const failed = index % 12 === 5
    const analyzedIndex = index - Math.floor((index + 6) / 12)
    const firstName = FIRST_NAMES[index % FIRST_NAMES.length]
    const lastName = LAST_NAMES[(index * 7) % LAST_NAMES.length]
    const title = `CV ${firstName} ${lastName}`
    cvs.push({
      id: `ejemplo-cv-${index + 1}`,
      title: title,
      type: 'CV',
      fileName: `${title}.pdf`,
      // Tamaños variados entre ~120 KB y ~440 KB.
      sizeBytes: 120_000 + ((index * 37_813) % 320_000),
      versionNumber: 1,
      createdAt: new Date(newest - index * 3 * 60 * 60 * 1000).toISOString(),
      analysisStatus: failed ? 'FAILED' : 'COMPLETED',
      analysisError: failed ? MOCK_FAILED_MESSAGE : null,
      analysisErrorCode: failed ? 'PDF_SIN_TEXTO' : null,
      pendingProposals: failed ? 0 : basePerCv + (analyzedIndex < extra ? 1 : 0),
    })
  }

  return cvs
}

const mockDocuments: DocumentItem[] = [
  ...buildMockCvs(),
  {
    id: 'ejemplo-perfil-1',
    title: 'Perfil de cargo - Técnico senior',
    type: 'JOB_PROFILE',
    fileName: 'Perfil de cargo - Técnico senior.pdf',
    sizeBytes: 182_400,
    versionNumber: 1,
    createdAt: '2026-11-06T15:20:00.000Z',
    analysisStatus: 'PENDING_ANALYSIS',
    analysisError: null,
    analysisErrorCode: null,
    pendingProposals: 0,
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
          // En modo de ejemplo no hay IA: el documento simulado queda sin analizar.
          analysisStatus: 'PENDING_ANALYSIS',
          analysisError: null,
          analysisErrorCode: null,
          pendingProposals: 0,
        }
        mockDocuments.unshift(document)
        resolve(document)
      }
    }, 150)
  })
}
