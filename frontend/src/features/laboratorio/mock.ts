// DATOS DE EJEMPLO para la página Laboratorio (empresa ficticia).
// - Estructura actual: solo según las reglas del modo de datos (ver src/shared/lib/load-data.ts).
// - Estructura propuesta: siempre (todavía no hay diagnóstico ni escenarios), con su aviso visible.
import type { CurrentOrgChart, OrgChartData } from './types'

// Estructura actual de ejemplo, con la misma forma que GET /api/positions/org-chart. Personas ficticias.
// Suma 46 personas (ver CLAUDE.md, problema 1: Figma dice 62).
function people(prefix: string, label: string, count: number): CurrentOrgChart['positions'][number]['people'] {
  return Array.from({ length: count }, (_, index) => ({
    employeeId: `${prefix}-${index + 1}`,
    fullName: count === 1 ? label : `${label} ${index + 1}`,
    allocationPercent: 100,
  }))
}

function samplePosition(
  id: string,
  title: string,
  departmentName: string,
  parentPositionId: string | null,
  staff: CurrentOrgChart['positions'][number]['people'],
): CurrentOrgChart['positions'][number] {
  return {
    id,
    title,
    departmentName,
    parentPositionId,
    criticality: 'MEDIUM',
    targetHeadcount: staff.length,
    currentHeadcount: staff.length,
    vacancies: 0,
    overstaffing: 0,
    people: staff,
  }
}

const CURRENT_POSITIONS = [
  samplePosition('gg', 'Gerente general / Dueño', 'Gerencia', null, people('gg', 'Persona de ejemplo (gerencia)', 1)),
  samplePosition('ip', 'Ing. de producto', 'Ingeniería', 'gg', people('ip', 'Persona de ejemplo (ingeniería)', 1)),
  samplePosition('ts', 'Técnico senior', 'Postventa', 'gg', people('ts', 'Técnico senior de ejemplo', 8)),
  samplePosition('tj', 'Técnico junior', 'Postventa', 'gg', people('tj', 'Técnico junior de ejemplo', 34)),
  samplePosition('adm', 'Administradora', 'Administración', 'gg', people('adm', 'Persona de ejemplo (administración)', 1)),
  samplePosition('ve', 'Vendedor externo', 'Comercial', 'gg', people('ve', 'Persona de ejemplo (ventas)', 1)),
]

export const MOCK_CURRENT_ORG_CHART: CurrentOrgChart = {
  organizationName: 'Compresores del Sur Ltda.',
  asOf: '2026-11-14',
  totals: { positions: CURRENT_POSITIONS.length, people: 46, vacancies: 0, overstaffed: 0 },
  positions: CURRENT_POSITIONS,
}

const PROPOSED_STRUCTURE: OrgChartData = {
  companyName: 'Compresores del Sur Ltda.',
  root: { title: 'Gerente general', note: 'foco estratégico', kind: 'existing' },
  directReports: [
    { title: 'Coord. proyectos', note: 'nuevo rol', kind: 'proposed' },
    { title: 'Jefe postventa', note: 'nuevo rol', kind: 'proposed' },
    { title: 'Administración', note: 'finanzas y RR.HH.', kind: 'existing' },
    { title: 'Ejec. comercial', note: 'nuevo rol · CRM', kind: 'proposed' },
  ],
  sections: [
    {
      title: 'Equipos bajo cada jefatura',
      nodes: [
        { title: 'Ing. de producto', note: 'reporta a Coord. proyectos', kind: 'existing' },
        { title: 'Téc. senior x8', note: 'reportan a Jefe postventa', kind: 'existing' },
        { title: 'Téc. junior x34', note: 'reportan a Jefe postventa', kind: 'existing' },
        { title: 'Vendedor externo', note: 'reporta a Ejec. comercial', kind: 'existing' },
      ],
    },
    {
      title: 'Roles de apoyo nuevos',
      nodes: [
        { title: 'Analista compras', note: 'nuevo rol · Administración', kind: 'proposed' },
        { title: 'Enc. calidad', note: 'nuevo rol · Postventa', kind: 'proposed' },
      ],
    },
  ],
  footnote: 'La propuesta es un ejemplo. La decisión final siempre la toma una persona.',
}

export const MOCK_PROPOSED_ORG_CHART: OrgChartData = PROPOSED_STRUCTURE
