import { z } from 'zod'

// Contrato de datos de la pantalla Laboratorio. Lo usan api.ts y mock.ts.
//
// - Estructura ACTUAL: datos reales de GET /api/positions/org-chart (api/src/modules/positions/org-chart.ts).
// - Estructura PROPUESTA: siempre datos de ejemplo (orgChartDataSchema); los módulos diagnostics y scenarios
//   todavía no existen.

// ---------- Estructura actual (GET /api/positions/org-chart) ----------

export const currentPersonSchema = z.object({
  employeeId: z.string(),
  fullName: z.string(),
  allocationPercent: z.number(),
})

export const currentPositionSchema = z.object({
  id: z.string(),
  title: z.string(),
  departmentName: z.string(),
  // null = raíz (sin cargo superior activo).
  parentPositionId: z.string().nullable(),
  criticality: z.string(),
  targetHeadcount: z.number().int(),
  // Personas (no jornadas) con asignación vigente hoy.
  currentHeadcount: z.number().int(),
  vacancies: z.number().int(),
  overstaffing: z.number().int(),
  people: z.array(currentPersonSchema),
})

export const currentOrgChartSchema = z.object({
  organizationName: z.string(),
  // AAAA-MM-DD
  asOf: z.string(),
  totals: z.object({
    positions: z.number().int(),
    people: z.number().int(),
    vacancies: z.number().int(),
    overstaffed: z.number().int(),
  }),
  positions: z.array(currentPositionSchema),
})

export type CurrentPosition = z.infer<typeof currentPositionSchema>
export type CurrentOrgChart = z.infer<typeof currentOrgChartSchema>

// ---------- Estructura propuesta (datos de ejemplo) ----------

// Tipo de cada caja del organigrama. Define su color.
//   existing:    rol existente sin problemas
//   overloaded:  rol que asume funciones ajenas
//   missing:     rol que no existe (sus funciones las hace otra persona)
//   proposed:    rol nuevo en la estructura propuesta
//   consequence: consecuencia detectada (retrasos, quiebres de stock, etc.)
export const nodeKindSchema = z.enum(['existing', 'overloaded', 'missing', 'proposed', 'consequence'])

export const orgNodeSchema = z.object({
  title: z.string(),
  note: z.string(),
  kind: nodeKindSchema,
})

// Grupo de cajas con un título (por ejemplo "Consecuencias detectadas").
export const orgSectionSchema = z.object({
  title: z.string(),
  nodes: z.array(orgNodeSchema),
})

export const orgChartDataSchema = z.object({
  companyName: z.string(),
  root: orgNodeSchema,
  // Cajas conectadas directamente con la raíz.
  directReports: z.array(orgNodeSchema),
  sections: z.array(orgSectionSchema),
  footnote: z.string(),
})


export type NodeKind = z.infer<typeof nodeKindSchema>
export type OrgNode = z.infer<typeof orgNodeSchema>
export type OrgChartData = z.infer<typeof orgChartDataSchema>
