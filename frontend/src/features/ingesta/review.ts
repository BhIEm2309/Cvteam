// Revisión humana de las competencias que propuso la IA para un CV (pantalla /ingesta/revision/:documentId).
// Contrato: api/src/modules/extraction/extraction.service.ts y proposal-review.service.ts.
//
// La revisión NO se simula con datos de ejemplo: confirmar crea competencias y datos de personas que usan otras
// pantallas, y simularlo daría la impresión de que quedó guardado. En modo mock la página lo explica.
import { z } from 'zod'
import { DATA_MODE } from '@/shared/lib/data-mode'
import { apiGet, apiPostJson } from '@/shared/lib/http'
import { analysisStatusSchema, documentTypeSchema } from './types'

export const REVIEW_AVAILABLE = DATA_MODE !== 'mock'

export const skillCategorySchema = z.enum(['TECHNICAL', 'BEHAVIORAL'])

export const proposalSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: skillCategorySchema,
  level: z.number().int().min(1).max(5).nullable(),
  excerpt: z.string(),
  reviewStatus: z.enum(['PENDING', 'CONFIRMED', 'DISMISSED']),
})

// GET /api/documents/:id/extraction
export const documentExtractionSchema = z.object({
  documentId: z.string(),
  documentVersionId: z.string(),
  documentTitle: z.string(),
  documentType: documentTypeSchema,
  employee: z.object({ id: z.string(), fullName: z.string() }).nullable(),
  suggestedEmployeeId: z.string().nullable(),
  status: analysisStatusSchema,
  run: z
    .object({
      model: z.string().nullable(),
      errorMessage: z.string().nullable(),
      candidateName: z.string().nullable(),
      discarded: z.array(z.object({ name: z.string(), reason: z.string() })),
    })
    .nullable(),
  proposals: z.array(proposalSchema),
})

// POST /api/documents/:id/extraction/review
export const reviewResultSchema = z.object({
  employee: z.object({ id: z.string(), fullName: z.string(), created: z.boolean() }).nullable(),
  createdSkills: z.array(z.string()),
  registered: z.array(z.string()),
  alreadyRegistered: z.array(z.string()),
  dismissed: z.number().int(),
  extraction: documentExtractionSchema,
})

// GET /api/employees (solo los campos que usa esta pantalla).
const employeeOptionSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  currentPositions: z.array(z.object({ positionTitle: z.string(), departmentName: z.string() })),
})

export type SkillCategory = z.infer<typeof skillCategorySchema>
export type Proposal = z.infer<typeof proposalSchema>
export type DocumentExtraction = z.infer<typeof documentExtractionSchema>
export type ReviewResult = z.infer<typeof reviewResultSchema>
export type EmployeeOption = z.infer<typeof employeeOptionSchema>

export interface ReviewDecisionBody {
  proposalId: string
  action: 'confirm' | 'dismiss'
  name?: string
  category?: SkillCategory
  level?: number | null
}

export interface ReviewBody {
  employeeId?: string
  newEmployeeName?: string
  decisions: ReviewDecisionBody[]
}

function documentPath(documentId: string): string {
  return `/api/documents/${encodeURIComponent(documentId)}/extraction`
}

export function getDocumentExtraction(documentId: string): Promise<DocumentExtraction> {
  return apiGet(documentPath(documentId), documentExtractionSchema, 'No se pudo cargar el análisis del CV.')
}

export function getEmployeeOptions(): Promise<EmployeeOption[]> {
  return apiGet('/api/employees', z.array(employeeOptionSchema), 'No se pudo cargar la lista de personas.')
}

export function saveReview(documentId: string, body: ReviewBody): Promise<ReviewResult> {
  return apiPostJson(`${documentPath(documentId)}/review`, body, reviewResultSchema, 'No se pudo guardar la revisión.')
}
