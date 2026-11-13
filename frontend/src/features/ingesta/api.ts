// Funciones para comunicarse con la API (carpeta api/ del proyecto).
// Todas las rutas empiezan con /api: Vite las reenvía al servidor de la API (ver vite.config.ts).

export type DocumentType = 'CV' | 'JOB_PROFILE' | 'SUPPORTING'

// Forma de cada documento que devuelve GET /api/documents.
export interface DocumentItem {
  id: string
  title: string
  type: DocumentType
  fileName: string
  sizeBytes: number
  versionNumber: number
  createdAt: string
  analysisStatus: 'PENDING_ANALYSIS'
}

// Nombres en español para mostrar en la interfaz.
export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  CV: 'CV',
  JOB_PROFILE: 'Perfil de cargo',
  SUPPORTING: 'Documento de apoyo',
}

// GET /api/documents
export async function getDocuments(): Promise<DocumentItem[]> {
  const response = await fetch('/api/documents')

  if (!response.ok) {
    const body = await response.text()
    throw new Error(getErrorMessage(body, 'No se pudo cargar la lista de documentos.'))
  }

  return response.json()
}

// POST /api/documents
// Se usa XMLHttpRequest en vez de fetch porque permite conocer el avance de la subida (onProgress).
export function uploadDocument(
  file: File,
  type: DocumentType,
  onProgress: (percent: number) => void,
): Promise<DocumentItem> {
  return new Promise((resolve, reject) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', type)

    const request = new XMLHttpRequest()
    request.open('POST', '/api/documents')

    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100)
        onProgress(percent)
      }
    }

    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        resolve(JSON.parse(request.responseText))
      } else {
        reject(new Error(getErrorMessage(request.responseText, 'No se pudo subir el archivo.')))
      }
    }

    request.onerror = () => {
      reject(new Error('No hay conexión con la API. Revisa que esté funcionando.'))
    }

    request.send(formData)
  })
}

// La API responde los errores como { "message": "..." }. Si no viene un mensaje, se usa el texto por defecto.
function getErrorMessage(responseText: string, defaultMessage: string): string {
  try {
    const body = JSON.parse(responseText)
    if (typeof body.message === 'string') {
      return body.message
    }
    if (Array.isArray(body.message)) {
      return body.message.join(' ')
    }
  } catch {
    // La respuesta no era JSON.
  }
  return defaultMessage
}
