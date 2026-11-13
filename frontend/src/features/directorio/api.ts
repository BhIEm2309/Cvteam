import { z } from 'zod'
import { DATA_MODE } from '@/shared/lib/data-mode'
import { apiGet, apiPutJson } from '@/shared/lib/http'
import { loadData, type Loaded } from '@/shared/lib/load-data'
import { MOCK_COLLABORATORS } from './mock'
import {
  collaboratorListSchema,
  positionSkillSchema,
  skillOptionSchema,
  type Collaborator,
  type PositionSkill,
  type SkillCategory,
  type SkillOption,
} from './types'

// GET /api/talent: personas, su cargo, sus competencias confirmadas y el ajuste al cargo.
export function getCollaborators(): Promise<Loaded<Collaborator[]>> {
  return loadData({
    fromApi: () => apiGet('/api/talent', collaboratorListSchema, 'No se pudo cargar el directorio de talento.'),
    fromMock: () => collaboratorListSchema.parse(MOCK_COLLABORATORS),
  })
}

// Editar requisitos de un cargo solo con la API real: cambia el ajuste de todas las personas de ese cargo,
// y simularlo daría la impresión de que quedó guardado.
export const REQUIREMENTS_EDIT_AVAILABLE = DATA_MODE !== 'mock'

// GET /api/skills
export function getSkillCatalog(): Promise<SkillOption[]> {
  return apiGet('/api/skills', z.array(skillOptionSchema), 'No se pudo cargar el catálogo de competencias.')
}

// GET /api/positions/:id/skills
export function getPositionSkills(positionId: string): Promise<PositionSkill[]> {
  return apiGet(
    `/api/positions/${encodeURIComponent(positionId)}/skills`,
    z.array(positionSkillSchema),
    'No se pudieron cargar los requisitos del cargo.',
  )
}

// Un requisito a guardar: competencia del catálogo (skillId) o nueva (name + category).
export type RequirementBody =
  | { skillId: string; requiredLevel: number | null; isMandatory: boolean; weight: number }
  | { name: string; category: SkillCategory; requiredLevel: number | null; isMandatory: boolean; weight: number }

// PUT /api/positions/:id/skills: reemplaza todos los requisitos del cargo.
export function savePositionSkills(positionId: string, requirements: RequirementBody[]): Promise<PositionSkill[]> {
  return apiPutJson(
    `/api/positions/${encodeURIComponent(positionId)}/skills`,
    { requirements },
    z.array(positionSkillSchema),
    'No se pudieron guardar los requisitos del cargo.',
  )
}
