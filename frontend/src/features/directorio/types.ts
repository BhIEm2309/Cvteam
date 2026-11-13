import { z } from 'zod'

// Contrato de datos de la pantalla Directorio de Talento. Lo usan api.ts y mock.ts.
// Debe coincidir con api/src/modules/talent/talent-item.ts (GET /api/talent) y con api/src/modules/skills.
// Niveles en escala 1 a 5 (la misma de la base). null = sin nivel indicado.

export const fitStatusSchema = z.enum(['optimo', 'critico', 'desaprovechado', 'sin-requisitos'])
export const skillCategorySchema = z.enum(['TECHNICAL', 'BEHAVIORAL'])
const levelSchema = z.number().int().min(1).max(5)

// Competencia confirmada de una persona.
export const talentSkillSchema = z.object({
  skillId: z.string(),
  name: z.string(),
  category: skillCategorySchema,
  level: levelSchema.nullable(),
  verificationStatus: z.enum(['DECLARED', 'VERIFIED', 'REJECTED']),
  evidenceExcerpt: z.string().nullable(),
})

// Requisito del cargo y cómo lo cumple la persona.
export const talentRequirementSchema = z.object({
  skillId: z.string(),
  name: z.string(),
  requiredLevel: levelSchema.nullable(),
  isMandatory: z.boolean(),
  weight: z.number().positive(),
  currentLevel: levelSchema.nullable(),
  hasSkill: z.boolean(),
  coverage: z.number().min(0).max(1),
})

export const collaboratorSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  area: z.string().nullable(),
  position: z.object({ id: z.string(), title: z.string() }).nullable(),
  skills: z.array(talentSkillSchema),
  requirements: z.array(talentRequirementSchema),
  // null si el cargo no tiene requisitos (o la persona no tiene cargo).
  fitPercent: z.number().min(0).max(100).nullable(),
  status: fitStatusSchema,
  // Explicación del estado según la regla de la API (api/src/modules/talent/fit-rules.ts).
  reasons: z.array(z.string()),
})

export const collaboratorListSchema = z.array(collaboratorSchema)

// GET /api/skills (catálogo de la organización).
export const skillOptionSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  category: skillCategorySchema,
  employeeCount: z.number().int().nonnegative(),
})

// GET y PUT /api/positions/:id/skills (requisitos de un cargo).
export const positionSkillSchema = z.object({
  skillId: z.string(),
  name: z.string(),
  category: skillCategorySchema,
  requiredLevel: levelSchema.nullable(),
  isMandatory: z.boolean(),
  weight: z.number().positive(),
})

export type FitStatus = z.infer<typeof fitStatusSchema>
export type SkillCategory = z.infer<typeof skillCategorySchema>
export type TalentSkill = z.infer<typeof talentSkillSchema>
export type TalentRequirement = z.infer<typeof talentRequirementSchema>
export type Collaborator = z.infer<typeof collaboratorSchema>
export type SkillOption = z.infer<typeof skillOptionSchema>
export type PositionSkill = z.infer<typeof positionSkillSchema>
