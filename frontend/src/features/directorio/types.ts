import { z } from 'zod'

// Contrato de datos de la pantalla Directorio de Talento. Lo usan api.ts y mock.ts.
// Ruta provisional: GET /api/talent (todavía no existe; necesita los módulos skills y diagnostics).

export const fitStatusSchema = z.enum(['optimo', 'critico', 'desaprovechado'])

// Nivel actual de una persona en una competencia vs. el nivel que exige su cargo (0 a 100).
export const competencySchema = z.object({
  name: z.string(),
  current: z.number().min(0).max(100),
  required: z.number().min(0).max(100),
})

export const collaboratorSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  area: z.string(),
  position: z.string(),
  keySkills: z.array(z.string()),
  fitPercent: z.number().min(0).max(100),
  status: fitStatusSchema,
  competencies: z.array(competencySchema),
})

export const collaboratorListSchema = z.array(collaboratorSchema)

export type FitStatus = z.infer<typeof fitStatusSchema>
export type Competency = z.infer<typeof competencySchema>
export type Collaborator = z.infer<typeof collaboratorSchema>
