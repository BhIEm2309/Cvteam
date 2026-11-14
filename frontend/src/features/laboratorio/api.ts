import { apiGet } from '@/shared/lib/http'
import { loadData, type Loaded } from '@/shared/lib/load-data'
import { MOCK_CURRENT_ORG_CHART, MOCK_PROPOSED_ORG_CHART } from './mock'
import { currentOrgChartSchema, orgChartDataSchema, type CurrentOrgChart, type OrgChartData } from './types'

// GET /api/positions/org-chart: estructura actual con datos reales (cargos, personas de hoy y vacantes).
export function getCurrentOrgChart(): Promise<Loaded<CurrentOrgChart>> {
  return loadData({
    fromApi: () => apiGet('/api/positions/org-chart', currentOrgChartSchema, 'No se pudo cargar el organigrama.'),
    fromMock: () => currentOrgChartSchema.parse(MOCK_CURRENT_ORG_CHART),
  })
}

// Estructura propuesta: SIEMPRE datos de ejemplo. No hay ruta en la API todavía (diagnóstico y escenarios no
// existen); la pantalla lo avisa en esa pestaña.
export function getProposedOrgChart(): OrgChartData {
  return orgChartDataSchema.parse(MOCK_PROPOSED_ORG_CHART)
}
