import { z } from 'zod'
import { DATA_MODE } from '@/shared/lib/data-mode'
import { apiPostForm } from '@/shared/lib/http'

// Contrato de POST /api/org-chart/import (api/src/modules/org-chart-import/org-chart-import-result.ts).
// La importación de organigrama NO se simula con datos de ejemplo: cambia áreas, cargos y personas que usan
// otras pantallas, y simularla daría la impresión de que quedó guardada.

const importErrorSchema = z.object({
  lines: z.array(z.number().int()),
  message: z.string(),
})

const importSummarySchema = z.object({
  departments: z.object({ created: z.array(z.string()), existing: z.number().int() }),
  positions: z.object({
    created: z.array(z.object({ title: z.string(), department: z.string(), targetHeadcount: z.number().int() })),
    parentChanged: z.array(
      z.object({ title: z.string(), department: z.string(), from: z.string().nullable(), to: z.string().nullable() }),
    ),
    headcountChanged: z.array(
      z.object({ title: z.string(), department: z.string(), from: z.number().int(), to: z.number().int() }),
    ),
    unchanged: z.number().int(),
  }),
  employees: z.object({
    created: z.array(z.object({ fullName: z.string(), position: z.string() })),
    positionChanged: z.array(z.object({ fullName: z.string(), from: z.string().nullable(), to: z.string() })),
    unchanged: z.number().int(),
  }),
  notInFile: z.array(z.object({ fullName: z.string(), position: z.string().nullable() })),
})

export const orgChartImportResultSchema = z.object({
  mode: z.enum(['preview', 'apply']),
  ok: z.boolean(),
  saved: z.boolean(),
  rowCount: z.number().int(),
  errors: z.array(importErrorSchema),
  // Avisos que no impiden importar (por ejemplo, dotación objetivo menor que las personas asignadas).
  warnings: z.array(importErrorSchema),
  summary: importSummarySchema.nullable(),
})

export type OrgChartImportResult = z.infer<typeof orgChartImportResultSchema>
export type OrgChartImportSummary = z.infer<typeof importSummarySchema>
export type OrgChartImportIssue = z.infer<typeof importErrorSchema>

// true si la importación está disponible (no en modo de ejemplo).
export const ORG_CHART_IMPORT_AVAILABLE = DATA_MODE !== 'mock'

// POST /api/org-chart/import?mode=preview|apply
export function importOrgChart(file: File, mode: 'preview' | 'apply'): Promise<OrgChartImportResult> {
  const formData = new FormData()
  formData.append('file', file)
  return apiPostForm(
    `/api/org-chart/import?mode=${mode}`,
    formData,
    orgChartImportResultSchema,
    'No se pudo importar el organigrama.',
  )
}

// Plantilla de ejemplo para descargar (personas ficticias). Usa ";" porque Excel en español la abre bien así.
// Debe coincidir con docs/plantilla-organigrama.csv (que prueba la API). "Técnico senior" declara dotación 3
// con 2 personas: muestra cómo indicar una vacante.
export const ORG_CHART_TEMPLATE = [
  'nombre;cargo;area;jefe_directo;codigo;dotacion_objetivo',
  'Ana Rojas;Gerente general;Gerencia;;;',
  'Pedro Soto;Jefe de postventa;Postventa;Ana Rojas;;',
  'Luis Vega;Técnico senior;Postventa;Pedro Soto;;3',
  'Marta Díaz;Técnico senior;Postventa;Pedro Soto;;3',
].join('\r\n')
