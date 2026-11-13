// Forma de cada organización que devuelve GET /api/organizations.
// Coincide con el contrato de la pantalla Hub (frontend/src/features/hub/types.ts).
export interface OrganizationItem {
  id: string;
  name: string;
  // El esquema todavía no guarda el RUT: siempre null por ahora.
  taxId: string | null;
  // Rubro de la empresa (columna industry). null si no se ha indicado.
  sector: string | null;
  // Personas activas (no archivadas).
  employees: number;
  // Cargos activos (no archivados).
  activeRoles: number;
}
