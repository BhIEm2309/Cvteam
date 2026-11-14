// Organigrama actual: cargos activos con su jerarquía, las personas asignadas hoy y sus vacantes.
// Función pura (sin base de datos), probada en test/org-chart.test.ts. La usa PositionsService.orgChart().
//
// Reglas (explicables, sin IA):
// - Se cuentan PERSONAS, no jornadas: una persona al 50 % cuenta como 1. Una persona con dos cargos aparece en ambos.
// - vacantes = max(dotación objetivo − personas, 0); sobredotación = max(personas − dotación objetivo, 0).
// - Un cargo cuyo superior no está en la lista (archivado) queda como raíz. Puede haber varias raíces.
// - Si los datos tuvieran un ciclo (la API y el importador lo impiden), se corta para que el árbol se pueda dibujar.

export interface OrgChartPositionInput {
  id: string;
  title: string;
  departmentName: string;
  parentPositionId: string | null;
  criticality: string;
  targetHeadcount: number;
  // Asignaciones vigentes hoy.
  assignments: { employeeId: string; fullName: string; allocationPercent: number }[];
}

export interface OrgChartPerson {
  employeeId: string;
  fullName: string;
  allocationPercent: number;
}

export interface OrgChartPosition {
  id: string;
  title: string;
  departmentName: string;
  // null = raíz (no tiene superior, o su superior no está activo).
  parentPositionId: string | null;
  criticality: string;
  targetHeadcount: number;
  currentHeadcount: number;
  vacancies: number;
  overstaffing: number;
  people: OrgChartPerson[];
}

export interface OrgChartResponse {
  organizationName: string;
  // Fecha (AAAA-MM-DD, hora de Chile) en que se calcularon las asignaciones vigentes.
  asOf: string;
  totals: {
    positions: number;
    // Personas distintas con al menos un cargo vigente.
    people: number;
    vacancies: number;
    // Cargos con más personas que su dotación objetivo.
    overstaffed: number;
  };
  positions: OrgChartPosition[];
}

const byText = (a: string, b: string) => a.localeCompare(b, 'es');

export function buildOrgChart(organizationName: string, asOf: string, input: OrgChartPositionInput[]): OrgChartResponse {
  const ids = new Set(input.map((position) => position.id));

  const positions: OrgChartPosition[] = input
    .map((position) => {
      // Una persona con dos asignaciones vigentes al mismo cargo se cuenta una vez (se suman sus porcentajes).
      const people = new Map<string, OrgChartPerson>();
      for (const assignment of position.assignments) {
        const existing = people.get(assignment.employeeId);
        people.set(assignment.employeeId, {
          employeeId: assignment.employeeId,
          fullName: assignment.fullName,
          allocationPercent: (existing?.allocationPercent ?? 0) + assignment.allocationPercent,
        });
      }
      const currentHeadcount = people.size;
      return {
        id: position.id,
        title: position.title,
        departmentName: position.departmentName,
        parentPositionId: position.parentPositionId !== null && ids.has(position.parentPositionId) ? position.parentPositionId : null,
        criticality: position.criticality,
        targetHeadcount: position.targetHeadcount,
        currentHeadcount,
        vacancies: Math.max(position.targetHeadcount - currentHeadcount, 0),
        overstaffing: Math.max(currentHeadcount - position.targetHeadcount, 0),
        people: [...people.values()].sort((a, b) => byText(a.fullName, b.fullName)),
      };
    })
    .sort((a, b) => byText(a.departmentName, b.departmentName) || byText(a.title, b.title) || byText(a.id, b.id));

  breakCycles(positions);

  return {
    organizationName,
    asOf,
    totals: {
      positions: positions.length,
      people: new Set(positions.flatMap((position) => position.people.map((person) => person.employeeId))).size,
      vacancies: positions.reduce((sum, position) => sum + position.vacancies, 0),
      overstaffed: positions.filter((position) => position.overstaffing > 0).length,
    },
    positions,
  };
}

// Deja como raíz al primer cargo (en el orden de la lista) de cada ciclo, hasta que todos sean alcanzables
// desde alguna raíz.
function breakCycles(positions: OrgChartPosition[]): void {
  const children = new Map<string | null, OrgChartPosition[]>();
  const reachable = new Set<string>();
  const index = () => {
    children.clear();
    for (const position of positions) {
      children.set(position.parentPositionId, [...(children.get(position.parentPositionId) ?? []), position]);
    }
  };
  const visit = (parentId: string | null) => {
    for (const child of children.get(parentId) ?? []) {
      if (!reachable.has(child.id)) {
        reachable.add(child.id);
        visit(child.id);
      }
    }
  };

  index();
  visit(null);
  for (const position of positions) {
    if (!reachable.has(position.id)) {
      position.parentPositionId = null;
      index();
      reachable.add(position.id);
      visit(position.id);
    }
  }
}
