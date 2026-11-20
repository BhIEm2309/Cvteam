import { apiGet, apiPatchJson, apiPostJson } from '@/shared/lib/http'
import { loadData, type Loaded } from '@/shared/lib/load-data'
import { MOCK_CURRENT_ORG_CHART, MOCK_PROPOSED_ORG_CHART } from './mock'
import {
  currentOrgChartSchema,
  latestDiagnosticSchema,
  orgChartDataSchema,
  recommendationSchema,
  runDiagnosticResponseSchema,
  type CurrentOrgChart,
  type LatestDiagnostic,
  type OrgChartData,
  type Recommendation,
} from './types'

// GET /api/positions/org-chart: estructura actual con datos reales (cargos, personas de hoy y vacantes).
export function getCurrentOrgChart(): Promise<Loaded<CurrentOrgChart>> {
  return loadData({
    fromApi: () => apiGet('/api/positions/org-chart', currentOrgChartSchema, 'No se pudo cargar el organigrama.'),
    fromMock: () => currentOrgChartSchema.parse(MOCK_CURRENT_ORG_CHART),
  })
}

// GET /api/diagnostics/latest: último diagnóstico guardado (run = null si nunca se ejecutó).
// En modo de ejemplo (o si la API no responde) no hay diagnóstico real: la pantalla muestra el ejemplo con su aviso.
export function getLatestDiagnostic(): Promise<Loaded<LatestDiagnostic>> {
  return loadData({
    fromApi: () => apiGet('/api/diagnostics/latest', latestDiagnosticSchema, 'No se pudo cargar el diagnóstico.'),
    fromMock: () => ({ run: null }),
  })
}

// POST /api/diagnostics: ejecuta el diagnóstico con los datos actuales (no se simula: guarda datos).
export function runDiagnostic() {
  return apiPostJson('/api/diagnostics', {}, runDiagnosticResponseSchema, 'No se pudo ejecutar el diagnóstico.')
}

// PATCH /api/diagnostics/recommendations/:id: registra la decisión de una persona (no cambia el organigrama).
export function decideRecommendation(id: string, status: 'ACCEPTED' | 'REJECTED'): Promise<Recommendation> {
  return apiPatchJson(
    `/api/diagnostics/recommendations/${encodeURIComponent(id)}`,
    { status },
    recommendationSchema,
    'No se pudo guardar la decisión.',
  )
}

// Estructura propuesta de EJEMPLO: se muestra en modo mock y como referencia de lo que todavía no se calcula
// (funciones ajenas, consecuencias). Siempre con su aviso amarillo.
export function getProposedOrgChart(): OrgChartData {
  return orgChartDataSchema.parse(MOCK_PROPOSED_ORG_CHART)
}
