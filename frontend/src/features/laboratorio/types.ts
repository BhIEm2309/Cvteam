import { z } from 'zod'

// Contrato de datos de la pantalla Laboratorio. Lo usan api.ts y mock.ts.
// Ruta provisional: GET /api/scenarios/org-chart (módulos positions, diagnostics y scenarios, todavía no existen).

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

// Estructura actual vs. estructura propuesta de una organización.
export const orgChartComparisonSchema = z.object({
  current: orgChartDataSchema,
  proposed: orgChartDataSchema,
})

export type NodeKind = z.infer<typeof nodeKindSchema>
export type OrgNode = z.infer<typeof orgNodeSchema>
export type OrgChartData = z.infer<typeof orgChartDataSchema>
export type OrgChartComparison = z.infer<typeof orgChartComparisonSchema>
