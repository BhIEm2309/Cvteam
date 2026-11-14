// Pruebas del organigrama actual (cargos, personas y vacantes). No usan base de datos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildOrgChart, type OrgChartPositionInput } from '../src/modules/positions/org-chart';

const person = (employeeId: string, fullName: string, allocationPercent = 100) => ({ employeeId, fullName, allocationPercent });
const position = (id: string, parentPositionId: string | null, targetHeadcount: number, assignments = [] as OrgChartPositionInput['assignments']): OrgChartPositionInput => ({
  id,
  title: id,
  departmentName: 'Postventa',
  parentPositionId,
  criticality: 'MEDIUM',
  targetHeadcount,
  assignments,
});

const find = (chart: ReturnType<typeof buildOrgChart>, id: string) => chart.positions.find((p) => p.id === id)!;

test('vacantes y sobredotación por cargo; los totales suman', () => {
  const chart = buildOrgChart('Empresa', '2026-11-14', [
    position('Gerente', null, 1, [person('ana', 'Ana Rojas')]),
    position('Técnico', 'Gerente', 3, [person('luis', 'Luis Vega'), person('marta', 'Marta Díaz')]),
    position('Analista', 'Gerente', 1, [person('rosa', 'Rosa'), person('juan', 'Juan')]),
    position('Bodeguero', 'Gerente', 2),
  ]);
  assert.deepEqual(
    [find(chart, 'Técnico'), find(chart, 'Analista'), find(chart, 'Bodeguero')].map((p) => [p.currentHeadcount, p.vacancies, p.overstaffing]),
    [[2, 1, 0], [2, 0, 1], [0, 2, 0]],
  );
  assert.deepEqual(chart.totals, { positions: 4, people: 5, vacancies: 3, overstaffed: 1 });
  assert.deepEqual(find(chart, 'Técnico').people.map((p) => p.fullName), ['Luis Vega', 'Marta Díaz']);
});

test('se cuentan personas, no jornadas; una persona con dos cargos aparece en ambos', () => {
  const chart = buildOrgChart('Empresa', '2026-11-14', [
    position('Jefe', null, 1, [person('ana', 'Ana', 50)]),
    position('Compras', 'Jefe', 1, [person('ana', 'Ana', 50)]),
  ]);
  assert.equal(find(chart, 'Jefe').currentHeadcount, 1);
  assert.equal(find(chart, 'Jefe').vacancies, 0);
  assert.equal(find(chart, 'Compras').people[0].fullName, 'Ana');
  assert.equal(chart.totals.people, 1, 'la persona se cuenta una vez en el total');
});

test('dos asignaciones vigentes de la misma persona al mismo cargo cuentan como una', () => {
  const chart = buildOrgChart('Empresa', '2026-11-14', [position('Técnico', null, 2, [person('luis', 'Luis', 50), person('luis', 'Luis', 30)])]);
  assert.equal(find(chart, 'Técnico').currentHeadcount, 1);
  assert.equal(find(chart, 'Técnico').people[0].allocationPercent, 80);
});

test('un cargo cuyo superior no está activo queda como raíz (puede haber varias)', () => {
  const chart = buildOrgChart('Empresa', '2026-11-14', [position('A', null, 1), position('B', 'archivado', 1)]);
  assert.equal(find(chart, 'B').parentPositionId, null);
});

test('un ciclo se corta para que el árbol se pueda dibujar', () => {
  const chart = buildOrgChart('Empresa', '2026-11-14', [position('A', 'B', 1), position('B', 'A', 1), position('C', 'A', 1)]);
  const roots = chart.positions.filter((p) => p.parentPositionId === null).map((p) => p.id);
  assert.deepEqual(roots, ['A']);
  assert.equal(find(chart, 'B').parentPositionId, 'A');
  assert.equal(find(chart, 'C').parentPositionId, 'A');
});

test('sin cargos: organigrama vacío', () => {
  const chart = buildOrgChart('Empresa', '2026-11-14', []);
  assert.deepEqual(chart.totals, { positions: 0, people: 0, vacancies: 0, overstaffed: 0 });
});
