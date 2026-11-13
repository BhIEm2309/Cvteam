// DATOS DE EJEMPLO para la página Hub. Empresas ficticias: no representan organizaciones reales.
// Se reemplazarán por datos de la API cuando exista el módulo de organizaciones.

export interface SampleOrganization {
  id: string
  name: string
  taxId: string
  sector: string
  employees: number
  activeRoles: number
}

export const SAMPLE_ORGANIZATIONS: SampleOrganization[] = [
  { id: '1', name: 'Compresores del Sur Ltda.', taxId: '76.100.200-1', sector: 'Industria', employees: 48, activeRoles: 9 },
  { id: '2', name: 'Minera Cerro Azul', taxId: '76.200.300-2', sector: 'Minería', employees: 2400, activeRoles: 24 },
  { id: '3', name: 'Faena Los Andes SpA', taxId: '76.300.400-3', sector: 'Minería', employees: 1800, activeRoles: 12 },
  { id: '4', name: 'Ingeniería Pacífico', taxId: '76.400.500-4', sector: 'Ingeniería', employees: 320, activeRoles: 15 },
  { id: '5', name: 'Constructora Elqui', taxId: '76.500.600-5', sector: 'Construcción', employees: 900, activeRoles: 5 },
  { id: '6', name: 'Forestal Valle Verde', taxId: '76.600.700-6', sector: 'Forestal', employees: 560, activeRoles: 7 },
  { id: '7', name: 'Comercial Norte Grande', taxId: '76.700.800-7', sector: 'Retail', employees: 1250, activeRoles: 11 },
  { id: '8', name: 'Transportes Coquimbo', taxId: '76.800.900-8', sector: 'Logística', employees: 210, activeRoles: 6 },
  { id: '9', name: 'Aceros del Pacífico', taxId: '76.900.100-9', sector: 'Siderurgia', employees: 1600, activeRoles: 14 },
]

// Color de la etiqueta de cada sector.
export const SECTOR_COLORS: Record<string, string> = {
  Minería: 'border-amber-400/40 text-amber-300',
  Industria: 'border-sky-400/40 text-sky-300',
  Ingeniería: 'border-blue-400/40 text-blue-300',
  Construcción: 'border-orange-400/40 text-orange-300',
  Forestal: 'border-emerald-400/40 text-emerald-300',
  Retail: 'border-violet-400/40 text-violet-300',
  Logística: 'border-teal-400/40 text-teal-300',
  Siderurgia: 'border-rose-400/40 text-rose-300',
}
