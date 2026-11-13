// Funciones de la pantalla Ingesta para comunicarse con la API (módulo documents).
import { DATA_MODE } from '@/shared/lib/data-mode'
import { API_UNAVAILABLE_HEADER, ApiNoDisponibleError, apiGet, classifyErrorResponse, parseResponse } from '@/shared/lib/http'
import { getFallbackReason, loadData, type DataSource, type Loaded } from '@/shared/lib/load-data'
import { getMockDocuments, simulateUpload } from './mock'
import { documentItemSchema, documentListSchema, type DocumentItem, type DocumentType } from './types'

// GET /api/documents
export function getDocuments(): Promise<Loaded<DocumentItem[]>> {
  return loadData({
    fromApi: () => apiGet('/api/documents', documentListSchema, 'No se pudo cargar la lista de documentos.'),
    fromMock: () => documentListSchema.parse(getMockDocuments()),
  })
}

// Sube un archivo. listSource es la fuente de la lista que el usuario está viendo.
// En modo "auto" la subida solo se simula si la lista ya venía de datos de ejemplo (el aviso amarillo está
// visible) y la API no responde. Si la lista vino de la API, cualquier falla se muestra: así nadie cree
// que un archivo quedó guardado sin estarlo.
export async function uploadDocument(
  file: File,
  type: DocumentType,
  onProgress: (percent: number) => void,
  listSource: DataSource | undefined,
): Promise<Loaded<DocumentItem>> {
  if (DATA_MODE === 'mock') {
    return { data: await simulateUpload(file, type, onProgress), source: 'mock', reason: 'modo-mock' }
  }

  try {
    return { data: await uploadToApi(file, type, onProgress), source: 'api' }
  } catch (error) {
    const reason = DATA_MODE === 'auto' && listSource === 'mock' ? getFallbackReason(error) : null
    if (reason === null) {
      throw error
    }
    return { data: await simulateUpload(file, type, onProgress), source: 'mock', reason }
  }
}

// POST /api/documents
// Se usa XMLHttpRequest en vez de fetch porque permite conocer el avance de la subida (onProgress).
function uploadToApi(file: File, type: DocumentType, onProgress: (percent: number) => void): Promise<DocumentItem> {
  const path = '/api/documents'

  return new Promise((resolve, reject) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', type)

    const request = new XMLHttpRequest()
    request.open('POST', path)

    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100)
        onProgress(percent)
      }
    }

    request.onload = () => {
      try {
        if (request.status >= 200 && request.status < 300) {
          resolve(parseResponse(path, request.status, request.responseText, documentItemSchema))
        } else {
          reject(
            classifyErrorResponse(
              path,
              request.status,
              request.getResponseHeader(API_UNAVAILABLE_HEADER),
              request.responseText,
              'No se pudo subir el archivo.',
            ),
          )
        }
      } catch (error) {
        reject(error)
      }
    }

    request.onerror = () => {
      reject(new ApiNoDisponibleError())
    }

    request.send(formData)
  })
}
