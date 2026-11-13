import { apiGet } from '@/shared/lib/http'
import { loadData, type Loaded } from '@/shared/lib/load-data'
import { MOCK_ORG_CHART } from './mock'
import { orgChartComparisonSchema, type OrgChartComparison } from './types'

// GET /api/scenarios/org-chart (ruta provisional: los módulos positions, diagnostics y scenarios todavía no existen).
export function getOrgChartComparison(): Promise<Loaded<OrgChartComparison>> {
  return loadData({
    fromApi: () => apiGet('/api/scenarios/org-chart', orgChartComparisonSchema, 'No se pudo cargar el organigrama.'),
    fromMock: () => orgChartComparisonSchema.parse(MOCK_ORG_CHART),
  })
}
