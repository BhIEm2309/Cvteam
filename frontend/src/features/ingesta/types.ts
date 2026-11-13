import { z } from 'zod'

// Contrato de datos de la pantalla Ingesta. Lo usan api.ts (valida la respuesta) y mock.ts (datos de ejemplo).
// Debe coincidir con DocumentListItem de la API (api/src/modules/documents/document-list-item.ts).

export const documentTypeSchema = z.enum(['CV', 'JOB_PROFILE', 'SUPPORTING'])

// Estado del último análisis con IA (api/src/modules/extraction/extraction-queue.ts).
// PENDING_ANALYSIS = nunca se analizó (por ejemplo, perfiles de cargo, que todavía no se analizan).
export const analysisStatusSchema = z.enum(['PENDING_ANALYSIS', 'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED'])

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
  analysisStatus: analysisStatusSchema,
  // Mensaje del error si el último análisis falló; si no, null.
  analysisError: z.string().nullable(),
  // Competencias propuestas por la IA que todavía nadie revisa.
  pendingProposals: z.number().int().nonnegative(),
})

// Respuesta de POST /api/documents/:id/extraction (solo se usa el estado).
export const extractionRequestSchema = z.object({ status: analysisStatusSchema })

export const documentListSchema = z.array(documentItemSchema)

export type DocumentType = z.infer<typeof documentTypeSchema>
export type AnalysisStatus = z.infer<typeof analysisStatusSchema>
export type DocumentItem = z.infer<typeof documentItemSchema>
