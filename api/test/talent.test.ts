// Pruebas de la regla de ajuste al cargo del Directorio de Talento (no usan base de datos).
// Ejecutar con: pnpm test (en la carpeta api).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateFit, FIT_RULES, requirementCoverage, type RequirementInput } from '../src/modules/talent/fit-rules';
import { parsePositionSkillsInput } from '../src/modules/skills/position-skills-input';

const req = (skillId: string, requiredLevel: number | null, isMandatory = true, weight = 1): RequirementInput => ({
  skillId,
  name: skillId.toUpperCase(),
  requiredLevel,
  isMandatory,
  weight,
});

test('cobertura de un requisito', () => {
  assert.equal(requirementCoverage(4, false, null), 0, 'no la tiene');
  assert.equal(requirementCoverage(null, true, null), 1, 'el requisito no exige nivel');
  assert.equal(requirementCoverage(4, true, null), FIT_RULES.unknownLevelCoverage, 'la tiene sin nivel');
  assert.equal(requirementCoverage(4, true, 2), 0.5);
  assert.equal(requirementCoverage(3, true, 5), 1, 'superar el nivel no da más de 1');
});

test('cargo sin requisitos: sin ajuste', () => {
  const result = evaluateFit([], [{ skillId: 'sap', level: 4 }]);
  assert.equal(result.status, 'sin-requisitos');
  assert.equal(result.fitPercent, null);
});

test('óptimo: cumple todo sin sobrar', () => {
  const result = evaluateFit([req('sap', 3), req('excel', 2)], [{ skillId: 'sap', level: 3 }, { skillId: 'excel', level: 3 }]);
  assert.equal(result.fitPercent, 100);
  assert.equal(result.status, 'optimo', 'exceso promedio 0,5: no alcanza para desaprovechado');
  assert.deepEqual(result.reasons, ['Cumple todos los requisitos del cargo.']);
});

test('crítico: falta una obligatoria aunque el ajuste sea alto', () => {
  const requirements = [req('a', 2), req('b', 2), req('c', 2), req('d', 2), req('e', 2, true)];
  const skills = ['a', 'b', 'c', 'd'].map((skillId) => ({ skillId, level: 2 }));
  const result = evaluateFit(requirements, skills);
  assert.equal(result.fitPercent, 80);
  assert.equal(result.status, 'critico');
  assert.equal(result.reasons[0], 'Falta la competencia obligatoria "E".');
});

test('crítico: ajuste bajo el mínimo sin faltar obligatorias', () => {
  const result = evaluateFit([req('sap', 4, false), req('excel', 4, false)], [{ skillId: 'sap', level: 2 }]);
  assert.equal(result.fitPercent, 25);
  assert.equal(result.status, 'critico');
  assert.match(result.reasons[0], /Ajuste de 25 %, bajo el mínimo de 60 %/);
  assert.ok(result.reasons.includes('No registra "EXCEL" (deseable).'));
  assert.ok(result.reasons.includes('"SAP": nivel 2 de 4 requerido.'));
});

test('el peso cambia el ajuste', () => {
  const skills = [{ skillId: 'sap', level: 4 }];
  const equal = evaluateFit([req('sap', 4, false, 1), req('excel', 4, false, 1)], skills);
  const heavy = evaluateFit([req('sap', 4, false, 3), req('excel', 4, false, 1)], skills);
  assert.equal(equal.fitPercent, 50);
  assert.equal(heavy.fitPercent, 75);
});

test('competencia sin nivel cuenta la mitad y se explica', () => {
  const result = evaluateFit([req('sap', 4), req('excel', 2)], [{ skillId: 'sap', level: null }, { skillId: 'excel', level: 2 }]);
  assert.equal(result.fitPercent, 75);
  // Antes del 19-11-2026 era "optimo"; con el estado "Ajuste parcial" (60 a 84 %) pasa a "parcial".
  assert.equal(result.status, 'parcial');
  assert.deepEqual(result.reasons, [
    'Ajuste de 75 %: cumple lo obligatorio, pero está bajo el 85 % de un ajuste óptimo.',
    '"SAP": la tiene, nivel por confirmar (requerido 4).',
  ]);
});

test('ajuste parcial: los límites de 60 % y 85 %', () => {
  // 3 de 5 requisitos deseables cumplidos = 60 % → parcial (no crítico); 17 de 20 = 85 % → óptimo.
  const five = ['a', 'b', 'c', 'd', 'e'].map((id) => req(id, null, false));
  assert.equal(evaluateFit(five, ['a', 'b', 'c'].map((skillId) => ({ skillId, level: null }))).status, 'parcial');
  const twenty = Array.from({ length: 20 }, (_, index) => req(`s${index}`, null, false));
  const has17 = Array.from({ length: 17 }, (_, index) => ({ skillId: `s${index}`, level: null }));
  const result = evaluateFit(twenty, has17);
  assert.equal(result.fitPercent, 85);
  assert.equal(result.status, 'optimo');
});

test('ejemplo del plan: jefe de postventa con 69 % es "Ajuste parcial"; el mismo CV en técnico senior es "desaprovechado"', () => {
  const persona = [
    { skillId: 'mantencion', level: 5 },
    { skillId: 'liderazgo', level: 3 },
    { skillId: 'planificacion', level: null },
    { skillId: 'atencion', level: 2 },
  ];
  const jefe = evaluateFit(
    [req('mantencion', 4, true, 2), req('liderazgo', 3), req('planificacion', 3), req('sap', 2, false), req('atencion', 3, false)],
    persona,
  );
  assert.equal(jefe.fitPercent, 69);
  assert.equal(jefe.status, 'parcial');

  const tecnico = evaluateFit([req('mantencion', 3), req('atencion', 2)], persona);
  assert.equal(tecnico.fitPercent, 100);
  assert.equal(tecnico.status, 'desaprovechado');
});

test('desaprovechado: 100 % y supera en promedio al menos 1 nivel', () => {
  const result = evaluateFit([req('sap', 2), req('excel', 3)], [{ skillId: 'sap', level: 4 }, { skillId: 'excel', level: 4 }]);
  assert.equal(result.fitPercent, 100);
  assert.equal(result.status, 'desaprovechado');
  assert.deepEqual(result.reasons, ['Supera en promedio 1,5 niveles lo que exige su cargo.']);
});

test('requisitos sin nivel requerido no cuentan para "desaprovechado"', () => {
  const result = evaluateFit([req('sap', null), req('ingles', null)], [{ skillId: 'sap', level: 5 }, { skillId: 'ingles', level: 5 }]);
  assert.equal(result.fitPercent, 100);
  assert.equal(result.status, 'optimo');
});

test('requisitos del cargo: valida la entrada y aplica valores por defecto', () => {
  const ID = '44444444-4444-4444-8444-444444444444';
  const parsed = parsePositionSkillsInput({
    requirements: [
      { skillId: ID, requiredLevel: 3 },
      { name: '  Inglés   técnico ', category: 'TECHNICAL', requiredLevel: null, isMandatory: false, weight: 0.29 },
    ],
  });
  assert.deepEqual(parsed[0], { skillId: ID, newSkill: null, requiredLevel: 3, isMandatory: true, weight: 1 });
  assert.deepEqual(parsed[1].newSkill, { name: 'Inglés técnico', category: 'TECHNICAL' });
  assert.equal(parsed[1].weight, 0.29, '0,29 no debe rechazarse por redondeo de decimales');
  assert.deepEqual(parsePositionSkillsInput({ requirements: [] }), []);

  const bad = (requirements: unknown, pattern: RegExp) => assert.throws(() => parsePositionSkillsInput({ requirements }), pattern);
  bad('x', /debe ser una lista/);
  bad([{ requiredLevel: 3 }], /Indica/);
  bad([{ name: 'X', category: 'OTRA' }], /TECHNICAL o BEHAVIORAL/);
  bad([{ skillId: ID, requiredLevel: 0 }], /entero de 1 a 5/);
  bad([{ skillId: ID, weight: 0 }], /mayor que 0/);
  bad([{ skillId: ID, weight: 1.234 }], /máximo 2 decimales/);
  bad([{ skillId: ID, isMandatory: 'si' }], /true o false/);
});
