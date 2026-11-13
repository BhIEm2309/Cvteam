import { apiGet } from '@/shared/lib/http'
import { loadData, type Loaded } from '@/shared/lib/load-data'
import { MOCK_COLLABORATORS } from './mock'
import { collaboratorListSchema, type Collaborator } from './types'

// GET /api/talent (ruta provisional, todavía no existe). Necesita habilidades y diagnóstico (pasos 5 y 6).
// No usa /api/employees: esa ruta ya existe y devuelve solo personas y cargos, sin el ajuste al cargo.
export function getCollaborators(): Promise<Loaded<Collaborator[]>> {
  return loadData({
    fromApi: () => apiGet('/api/talent', collaboratorListSchema, 'No se pudo cargar el directorio de talento.'),
    fromMock: () => collaboratorListSchema.parse(MOCK_COLLABORATORS),
  })
}
