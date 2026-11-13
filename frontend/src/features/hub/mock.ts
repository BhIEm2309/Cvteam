// DATOS DE EJEMPLO para la página Hub. Empresas ficticias: no representan organizaciones reales.
// Se usan solo según las reglas del modo de datos (ver src/shared/lib/load-data.ts).
import type { Organization } from './types'

export const MOCK_ORGANIZATIONS: Organization[] = [
  { id: '1', name: 'Compresores del Sur Ltda.', taxId: '76.100.200-1', sector: 'Industria', employees: 62, activeRoles: 9 },
  { id: '2', name: 'Minera Cerro Azul', taxId: '76.200.300-2', sector: 'Minería', employees: 2400, activeRoles: 24 },
  { id: '3', name: 'Faena Los Andes SpA', taxId: '76.300.400-3', sector: 'Minería', employees: 1800, activeRoles: 12 },
  { id: '4', name: 'Ingeniería Pacífico', taxId: '76.400.500-4', sector: 'Ingeniería', employees: 320, activeRoles: 15 },
  { id: '5', name: 'Constructora Elqui', taxId: '76.500.600-5', sector: 'Construcción', employees: 900, activeRoles: 5 },
  { id: '6', name: 'Forestal Valle Verde', taxId: '76.600.700-6', sector: 'Forestal', employees: 560, activeRoles: 7 },
  { id: '7', name: 'Comercial Norte Grande', taxId: '76.700.800-7', sector: 'Retail', employees: 1250, activeRoles: 11 },
  { id: '8', name: 'Transportes Coquimbo', taxId: '76.800.900-8', sector: 'Logística', employees: 210, activeRoles: 6 },
  { id: '9', name: 'Aceros del Pacífico', taxId: '76.900.100-9', sector: 'Siderurgia', employees: 1600, activeRoles: 14 },
]
