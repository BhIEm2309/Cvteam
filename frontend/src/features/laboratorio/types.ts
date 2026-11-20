import { z } from 'zod'

// Contrato de datos de la pantalla Laboratorio. Lo usan api.ts y mock.ts.
//
// - Estructura ACTUAL: datos reales de GET /api/positions/org-chart (api/src/modules/positions/org-chart.ts).
// - Estructura PROPUESTA: datos reales del último diagnóstico (GET /api/diagnostics/latest, más abajo). El ejemplo
//   anterior (orgChartDataSchema) se mantiene para el modo mock y para lo que todavía no se calcula (funciones ajenas);
//   ese ejemplo siempre va con su aviso amarillo.

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

// ---------- Diagnóstico (GET /api/diagnostics/latest, POST /api/diagnostics) ----------
// Contrato: api/src/modules/diagnostics/diagnostic-run-item.ts. Reglas explicables, sin IA (diagnostic-rules.ts).

export const severitySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
export const findingTypeSchema = z.enum(['UNFILLED_POSITION', 'SKILL_GAP', 'UNDERUSED_TALENT', 'INSUFFICIENT_DATA'])
export const fitStatusSchema = z.enum(['optimo', 'parcial', 'critico', 'desaprovechado', 'sin-requisitos'])

// Datos de una recomendación según su tipo (metadata.kind). "reasignar" = proponer a una persona para un cargo.
export const recommendationMetadataSchema = z
  .object({
    kind: z.string(),
    employeeId: z.string().optional(),
    employeeName: z.string().optional(),
    toPositionId: z.string().optional(),
    toPositionTitle: z.string().optional(),
    fitPercent: z.number().nullable().optional(),
    fromPositionTitle: z.string().nullable().optional(),
  })
  .passthrough()

export const recommendationSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  priority: severitySchema,
  status: z.enum(['PROPOSED', 'ACCEPTED', 'REJECTED', 'APPLIED']),
  metadata: recommendationMetadataSchema,
  decidedAt: z.string().nullable(),
  decisionNotes: z.string().nullable(),
})

const levelGapSchema = z.object({ name: z.string(), currentLevel: z.number().nullable(), requiredLevel: z.number().nullable() })

// Métricas del hallazgo: solo los campos que usa la pantalla (los demás se conservan tal cual).
export const findingMetricsSchema = z
  .object({
    fitPercent: z.number().nullable().optional(),
    status: fitStatusSchema.optional(),
    missing: z.array(z.object({ name: z.string(), isMandatory: z.boolean(), requiredLevel: z.number().nullable() })).optional(),
    belowLevel: z.array(levelGapSchema).optional(),
    aboveLevel: z.array(levelGapSchema).optional(),
    notRequired: z.array(z.object({ name: z.string(), level: z.number().nullable() })).optional(),
    bestFits: z
      .array(z.object({ positionId: z.string(), title: z.string(), fitPercent: z.number().nullable(), status: fitStatusSchema }))
      .optional(),
  })
  .passthrough()

export const findingSchema = z.object({
  id: z.string(),
  ruleCode: z.string(),
  type: findingTypeSchema,
  severity: severitySchema,
  title: z.string(),
  description: z.string(),
  positionId: z.string().nullable(),
  employeeId: z.string().nullable(),
  metrics: findingMetricsSchema,
  evidence: z.array(z.object({ id: z.string(), excerpt: z.string() })),
  recommendations: z.array(recommendationSchema),
})

export const diagnosticSummarySchema = z.object({
  positions: z.number().int(),
  people: z.number().int(),
  vacancies: z.number().int(),
  positionsWithoutPeople: z.number().int(),
  byStatus: z.record(fitStatusSchema, z.number().int()),
  peopleWithoutData: z.number().int(),
  peopleWithoutPosition: z.number().int(),
  positionsWithoutProfile: z.number().int(),
  reassignmentProposals: z.number().int(),
})

export const diagnosticRunSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  asOfDate: z.string(),
  rulesetVersion: z.string(),
  // true = los datos cambiaron después de este diagnóstico.
  isOutdated: z.boolean(),
  summary: diagnosticSummarySchema,
  findings: z.array(findingSchema),
})

export const latestDiagnosticSchema = z.object({ run: diagnosticRunSchema.nullable() })
export const runDiagnosticResponseSchema = z.object({ created: z.boolean(), run: diagnosticRunSchema })

export type Severity = z.infer<typeof severitySchema>
export type FitStatus = z.infer<typeof fitStatusSchema>
export type Recommendation = z.infer<typeof recommendationSchema>
export type Finding = z.infer<typeof findingSchema>
export type DiagnosticRun = z.infer<typeof diagnosticRunSchema>
export type LatestDiagnostic = z.infer<typeof latestDiagnosticSchema>
