import { z } from 'zod'

// Contrato de datos de la pantalla Hub. Lo usan api.ts (valida la respuesta) y mock.ts (datos de ejemplo).
// Ruta provisional: GET /api/organizations (módulo organizations, todavía no existe).

export const organizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  taxId: z.string(),
  sector: z.string(),
  employees: z.number().int().nonnegative(),
  activeRoles: z.number().int().nonnegative(),
})

export const organizationListSchema = z.array(organizationSchema)

export type Organization = z.infer<typeof organizationSchema>
