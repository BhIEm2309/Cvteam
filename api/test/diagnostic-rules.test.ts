// Pruebas de las reglas del diagnóstico (no usan base de datos ni IA).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DiagnosticEmployee, DiagnosticInput, DiagnosticPosition, runDiagnostic } from '../src/modules/diagnostics/diagnostic-rules';
import { RequirementInput } from '../src/modules/talent/fit-rules';

const req = (skillId: string, requiredLevel: number | null, isMandatory = true, weight = 1): RequirementInput => ({
  skillId,
  name: skillId,
  requiredLevel,
  isMandatory,
  weight,
});

const position = (id: string, targetHeadcount: number, requirements: RequirementInput[], parentPositionId: string | null = 'gg'): DiagnosticPosition => ({
  id,
  title: id,
  departmentId: 'dep',
  departmentName: 'Área',
  parentPositionId,
  targetHeadcount,
  requirements,
});

const person = (id: string, positionIds: string[], skills: [string, number | null][]): DiagnosticEmployee => ({
  id,
  fullName: id,
  positionIds,
  skills: skills.map(([skillId, level]) => ({ skillId, name: skillId, level, evidenceId: `ev-${id}-${skillId}` })),
});

// Empresa parecida al organigrama de prueba: faltan el jefe de postventa y el coordinador de proyectos.
const JEFE = [req('mantencion', 4, true, 2), req('liderazgo', 3), req('planificacion', 3), req('sap', 2, false), req('atencion', 3, false)];
const INPUT: DiagnosticInput = {
  positions: [
    position('gerente', 1, [], null),
    position('tecnico-senior', 2, [req('mantencion', 3), req('atencion', 2, false)]),
    position('jefe-postventa', 1, JEFE),
    position('coord-proyectos', 1, [req('gestion', 3), req('planificacion', 3), req('comunicacion', 2, false)]),
  ],
  employees: [
    person('ana', ['gerente'], [['estrategia', 4]]),
    person('luis', ['tecnico-senior'], [['mantencion', 5], ['atencion', 4]]),
    person('marta', ['tecnico-senior'], [['atencion', 2]]),
    person('rosa', ['tecnico-senior'], []),
    // Sin cargo: CVs revisados de personas que no están en el organigrama.
    person('matias', [], [['mantencion', 5], ['liderazgo', 3], ['planificacion', null], ['atencion', 2]]),
    person('valentina', [], [['gestion', 4], ['planificacion', 3], ['comunicacion', 3]]),
  ],
};

const result = runDiagnostic(INPUT);
const finding = (fingerprint: string) => result.findings.find((f) => f.fingerprint === fingerprint);

test('vacantes: rol sin personas (alta) y propone a quien cumple el perfil', () => {
  const coord = finding('vacante:coord-proyectos')!;
  assert.equal(coord.ruleCode, 'ROL_SIN_PERSONAS');
  assert.equal(coord.severity, 'HIGH');
  assert.deepEqual(coord.metrics, { targetHeadcount: 1, currentHeadcount: 0, vacancies: 1, hasProfile: true });
  assert.deepEqual(coord.recommendations.map((r) => [r.metadata.kind, r.metadata.employeeId, r.metadata.fitPercent]), [['reasignar', 'valentina', 100]]);
});

test('vacante sin candidatos: Matías tiene 69 % para jefe de postventa (ajuste parcial), no se propone', () => {
  const jefe = finding('vacante:jefe-postventa')!;
  assert.deepEqual(jefe.recommendations.map((r) => r.metadata.kind), ['buscar-candidatos']);
  assert.match(jefe.recommendations[0].description, /Obligatorias: mantencion, liderazgo, planificacion/);
});

test('sobredotación no es vacante: técnico senior tiene 3 personas para dotación 2', () => {
  assert.equal(finding('vacante:tecnico-senior'), undefined);
  assert.equal(result.summary.vacancies, 2);
  assert.equal(result.summary.positionsWithoutPeople, 2);
});

test('desajuste crítico con su evidencia: a Marta le falta una obligatoria', () => {
  const marta = finding('ajuste:marta')!;
  assert.equal(marta.ruleCode, 'DESAJUSTE_CRITICO');
  assert.equal(marta.severity, 'HIGH');
  assert.deepEqual(marta.metrics.missing, [{ name: 'mantencion', isMandatory: true, requiredLevel: 3 }]);
  assert.deepEqual(marta.recommendations.map((r) => r.metadata.kind), ['desarrollo']);
});

test('talento desaprovechado: Luis supera el perfil; la evidencia son las competencias que sobran', () => {
  const luis = finding('ajuste:luis')!;
  assert.equal(luis.type, 'UNDERUSED_TALENT');
  assert.deepEqual(luis.metrics.aboveLevel, [
    { name: 'mantencion', currentLevel: 5, requiredLevel: 3 },
    { name: 'atencion', currentLevel: 4, requiredLevel: 2 },
  ]);
  assert.deepEqual(luis.evidenceIds, ['ev-luis-mantencion', 'ev-luis-atencion']);
  // Le falta liderazgo (obligatoria) para jefe de postventa: no se propone moverlo; se sugiere más responsabilidad.
  assert.deepEqual(luis.recommendations.map((r) => r.metadata.kind), ['mas-responsabilidades']);
});

test('sin competencias confirmadas: falta información, no es desajuste', () => {
  const rosa = finding('sin-competencias:rosa')!;
  assert.equal(rosa.type, 'INSUFFICIENT_DATA');
  assert.equal(finding('ajuste:rosa'), undefined);
  assert.equal(result.summary.peopleWithoutData, 1);
});

test('persona sin cargo: se muestran sus mejores ajustes aunque no sea candidata', () => {
  const matias = finding('sin-cargo:matias')!;
  assert.equal(matias.severity, 'LOW');
  assert.deepEqual(matias.recommendations, []);
  const best = matias.metrics.bestFits as { positionId: string; fitPercent: number; status: string }[];
  assert.deepEqual(best[0], { positionId: 'tecnico-senior', title: 'tecnico-senior', fitPercent: 100, status: 'desaprovechado' });
  assert.ok(best.some((item) => item.positionId === 'jefe-postventa' && item.fitPercent === 69 && item.status === 'parcial'));

  const valentina = finding('sin-cargo:valentina')!;
  assert.equal(valentina.severity, 'MEDIUM');
  assert.equal(valentina.recommendations[0].metadata.toPositionId, 'coord-proyectos');
});

test('cargo sin perfil y resumen', () => {
  assert.equal(finding('sin-perfil:gerente')?.type, 'INSUFFICIENT_DATA');
  assert.deepEqual(result.summary.byStatus, { optimo: 0, parcial: 0, critico: 1, desaprovechado: 1, 'sin-requisitos': 1 });
  assert.equal(result.summary.peopleWithoutPosition, 2);
  assert.equal(result.summary.positionsWithoutProfile, 1);
  assert.equal(result.summary.reassignmentProposals, 2, 'Valentina aparece en la vacante y en su propio hallazgo');
});

test('a quien está bien en su cargo no se le propone moverse (abriría otra vacante)', () => {
  const input: DiagnosticInput = {
    positions: [position('a', 1, [req('x', 2)]), position('b', 1, [req('x', 2)])],
    employees: [person('p', ['a'], [['x', 2]])],
  };
  const vacancy = runDiagnostic(input).findings.find((f) => f.fingerprint === 'vacante:b')!;
  assert.deepEqual(vacancy.recommendations.map((r) => r.metadata.kind), ['buscar-candidatos']);
});

test('desaprovechado solo se propone hacia un cargo donde ya no quedaría desaprovechado', () => {
  const input: DiagnosticInput = {
    positions: [position('facil', 1, [req('x', 2)]), position('igual', 1, [req('x', 2)]), position('exigente', 1, [req('x', 5)])],
    employees: [person('p', ['facil'], [['x', 5]])],
  };
  const findings = runDiagnostic(input).findings;
  assert.deepEqual(findings.find((f) => f.fingerprint === 'vacante:igual')!.recommendations.map((r) => r.metadata.kind), ['buscar-candidatos']);
  assert.equal(findings.find((f) => f.fingerprint === 'vacante:exigente')!.recommendations[0].metadata.employeeId, 'p');
});

test('el resultado no depende del orden de entrada de los requisitos', () => {
  const shuffled = { ...INPUT, positions: INPUT.positions.map((p) => ({ ...p, requirements: [...p.requirements].reverse() })) };
  const again = runDiagnostic(shuffled);
  assert.deepEqual(
    again.findings.map((f) => [f.fingerprint, f.metrics.fitPercent ?? null]),
    result.findings.map((f) => [f.fingerprint, f.metrics.fitPercent ?? null]),
  );
});
