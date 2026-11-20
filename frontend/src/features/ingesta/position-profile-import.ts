import { z } from 'zod'
import { apiPostForm } from '@/shared/lib/http'

// Contrato de POST /api/position-profiles/import (api/src/modules/skills/position-profile-import-result.ts).
// Igual que el organigrama, NO se simula con datos de ejemplo: cambia los requisitos de los cargos que usan el
// Directorio y el diagnóstico, y simularlo daría la impresión de que quedó guardado.

const issueSchema = z.object({
  lines: z.array(z.number().int()),
  message: z.string(),
})

const summarySchema = z.object({
  positions: z.array(
    z.object({
      title: z.string(),
      department: z.string(),
      previousCount: z.number().int(),
      requirements: z.array(
        z.object({
          name: z.string(),
          category: z.enum(['TECHNICAL', 'BEHAVIORAL']),
          requiredLevel: z.number().int().nullable(),
          isMandatory: z.boolean(),
          weight: z.number(),
          isNewSkill: z.boolean(),
        }),
      ),
      removed: z.array(z.string()),
    }),
  ),
  createdSkills: z.array(z.string()),
  positionsNotInFile: z.number().int(),
})

export const positionProfileImportResultSchema = z.object({
  mode: z.enum(['preview', 'apply']),
  ok: z.boolean(),
  saved: z.boolean(),
  rowCount: z.number().int(),
  errors: z.array(issueSchema),
  warnings: z.array(issueSchema),
  summary: summarySchema.nullable(),
})

export type PositionProfileImportResult = z.infer<typeof positionProfileImportResultSchema>
export type PositionProfileImportSummary = z.infer<typeof summarySchema>

// POST /api/position-profiles/import?mode=preview|apply
export function importPositionProfiles(file: File, mode: 'preview' | 'apply'): Promise<PositionProfileImportResult> {
  const formData = new FormData()
  formData.append('file', file)
  return apiPostForm(
    `/api/position-profiles/import?mode=${mode}`,
    formData,
    positionProfileImportResultSchema,
    'No se pudieron importar los perfiles de cargo.',
  )
}

// Plantilla de ejemplo para descargar. Usa los cargos de la plantilla de organigrama (docs/plantilla-organigrama.csv),
// para que se pueda probar importando primero una y después la otra. Debe coincidir con docs/plantilla-perfiles-cargo.csv.
export const POSITION_PROFILE_TEMPLATE = [
  'cargo;area;competencia;categoria;nivel_minimo;obligatoria;peso',
  'Jefe de postventa;Postventa;Mantención de compresores;tecnica;4;si;2',
  'Jefe de postventa;Postventa;Liderazgo de equipos;blanda;3;si;1',
  'Jefe de postventa;Postventa;SAP PM;tecnica;2;no;1',
  'Técnico senior;Postventa;Mantención de compresores;tecnica;3;si;2',
  'Técnico senior;Postventa;Atención al cliente;blanda;2;no;1',
].join('\r\n')
