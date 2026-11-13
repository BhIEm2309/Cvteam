import { apiGet } from '@/shared/lib/http'
import { loadData, type Loaded } from '@/shared/lib/load-data'
import { MOCK_COLLABORATORS } from './mock'
import { collaboratorListSchema, type Collaborator } from './types'

// GET /api/employees (ruta provisional: los módulos employees y skills todavía no existen).
export function getCollaborators(): Promise<Loaded<Collaborator[]>> {
  return loadData({
    fromApi: () => apiGet('/api/employees', collaboratorListSchema, 'No se pudo cargar el directorio de talento.'),
    fromMock: () => collaboratorListSchema.parse(MOCK_COLLABORATORS),
  })
}
