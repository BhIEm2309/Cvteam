import { z } from 'zod'

// Contrato de datos de la pantalla Ingesta. Lo usan api.ts (valida la respuesta) y mock.ts (datos de ejemplo).
// Debe coincidir con DocumentListItem de la API (api/src/modules/documents/document-list-item.ts).

export const documentTypeSchema = z.enum(['CV', 'JOB_PROFILE', 'SUPPORTING'])

// Forma de cada documento que devuelve GET /api/documents (y POST /api/documents).
export const documentItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: documentTypeSchema,
  fileName: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  versionNumber: z.number().int().positive(),
  // Fecha en formato ISO (la API la envía como texto).
  createdAt: z.string(),
  // Mientras no exista el análisis con IA, todos los documentos quedan "PENDING_ANALYSIS".
  analysisStatus: z.literal('PENDING_ANALYSIS'),
})

export const documentListSchema = z.array(documentItemSchema)

export type DocumentType = z.infer<typeof documentTypeSchema>
export type DocumentItem = z.infer<typeof documentItemSchema>
