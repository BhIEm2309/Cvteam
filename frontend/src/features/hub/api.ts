import { apiGet } from '@/shared/lib/http'
import { loadData, type Loaded } from '@/shared/lib/load-data'
import { MOCK_ORGANIZATIONS } from './mock'
import { organizationListSchema, type Organization } from './types'

// GET /api/organizations (módulo organizations de la API).
export function getOrganizations(): Promise<Loaded<Organization[]>> {
  return loadData({
    fromApi: () => apiGet('/api/organizations', organizationListSchema, 'No se pudo cargar la lista de organizaciones.'),
    // Los datos de ejemplo también se validan: si quedan desactualizados respecto del contrato, falla visiblemente.
    fromMock: () => organizationListSchema.parse(MOCK_ORGANIZATIONS),
  })
}
