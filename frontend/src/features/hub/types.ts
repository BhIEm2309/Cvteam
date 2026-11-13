import { z } from 'zod'

// Contrato de datos de la pantalla Hub. Lo usan api.ts (valida la respuesta) y mock.ts (datos de ejemplo).
// Ruta: GET /api/organizations (api/src/modules/organizations/organization-item.ts).

export const organizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  // El esquema de la base todavía no guarda el RUT: la API envía null.
  taxId: z.string().nullable(),
  // Rubro de la empresa; null si no se ha indicado.
  sector: z.string().nullable(),
  employees: z.number().int().nonnegative(),
  activeRoles: z.number().int().nonnegative(),
})

export const organizationListSchema = z.array(organizationSchema)

export type Organization = z.infer<typeof organizationSchema>
