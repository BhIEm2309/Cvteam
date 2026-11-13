// Pruebas de la lectura y validación del CSV de organigrama (no usan base de datos).
// Ejecutar con: pnpm test (en la carpeta api).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPlan,
  decodeCsv,
  detectDelimiter,
  generateCode,
  normalizeKey,
  OrgChartFileError,
  parseOrgChartCsv,
  readRows,
} from '../src/modules/org-chart-import/org-chart-csv';

const csv = (text: string) => Buffer.from(text, 'utf8');

const VALID = `nombre,cargo,area,jefe_directo
Ana Rojas,Gerente general,Gerencia,
Pedro Soto,Jefe de postventa,Postventa,Ana Rojas
Luis Vega,Técnico senior,Postventa,Pedro Soto
Marta Díaz,Técnico senior,Postventa,Pedro Soto
`;

test('organigrama válido: áreas, cargos con su superior y personas', () => {
  const result = parseOrgChartCsv(csv(VALID));
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.rowCount, 4);
  assert.deepEqual(result.plan.departments.map((d) => d.name), ['Gerencia', 'Postventa']);
  assert.equal(result.plan.positions.length, 3);

  const tecnico = result.plan.positions.find((p) => p.title === 'Técnico senior');
  assert.equal(tecnico?.parentKey, 'postventa|jefe de postventa');
  const gerente = result.plan.positions.find((p) => p.title === 'Gerente general');
  assert.equal(gerente?.parentKey, null);
  assert.equal(result.plan.employees.length, 4);
});

test('acepta ; como separador, BOM de Excel y encabezados con tildes y mayúsculas', () => {
  const text = '﻿Nombre;Cargo;Área;Jefe directo\nAna Rojas;Gerente;Gerencia;\nLuis Vega;Técnico;Operaciones;ana rojas\n';
  assert.equal(detectDelimiter(text), ';');
  const result = parseOrgChartCsv(csv(text));
  assert.equal(result.ok, true);
});

test('rechaza archivos que no están en UTF-8 (Excel "ANSI")', () => {
  // "Área" en Windows-1252: Á = 0xC1, que no es UTF-8 válido por sí solo.
  const latin1 = Buffer.from([0x4e, 0x6f, 0x6d, 0x62, 0x72, 0x65, 0x2c, 0xc1, 0x72, 0x65, 0x61]);
  assert.throws(() => decodeCsv(latin1), OrgChartFileError);
});

test('rechaza archivos sin columnas obligatorias o vacíos', () => {
  assert.throws(() => readRows('nombre,cargo\nAna,Gerente\n'), /Faltan columnas obligatorias: area/);
  assert.throws(() => readRows(''), OrgChartFileError);
  assert.throws(() => readRows('nombre,cargo,area\n'), /solo tiene encabezados/);
});

test('informa filas con datos faltantes con su número de línea', () => {
  const result = parseOrgChartCsv(csv('nombre,cargo,area\nAna,Gerente,Gerencia\nLuis,,Operaciones\n'));
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.deepEqual(result.errors[0].lines, [3]);
  assert.match(result.errors[0].message, /Falta cargo/);
});

test('jefe que no existe en el archivo', () => {
  const result = parseOrgChartCsv(csv('nombre,cargo,area,jefe_directo\nAna,Gerente,Gerencia,Carlos Pérez\n'));
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.errors[0].message, /no aparece como persona/);
});

test('nombres repetidos sin código son error; con código se distinguen', () => {
  const repeated = 'nombre,cargo,area\nJuan Pérez,Técnico,Operaciones\nJuan Pérez,Técnico,Operaciones\n';
  const bad = parseOrgChartCsv(csv(repeated));
  assert.equal(bad.ok, false);
  if (!bad.ok) {
    assert.deepEqual(bad.errors[0].lines, [2, 3]);
  }

  const withCodes = 'nombre,cargo,area,codigo\nJuan Pérez,Técnico,Operaciones,111\nJuan Pérez,Técnico,Operaciones,222\n';
  assert.equal(parseOrgChartCsv(csv(withCodes)).ok, true);
});

test('jefe ambiguo: dos personas con el mismo nombre', () => {
  const text = 'nombre,cargo,area,jefe_directo,codigo\nJuan Pérez,Jefe A,Ops,,1\nJuan Pérez,Jefe B,Ops,,2\nLuis,Técnico,Ops,Juan Pérez,3\n';
  const result = parseOrgChartCsv(csv(text));
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.errors[0].message, /Indica el jefe por su código/);
  }
  // Con el código del jefe sí se resuelve.
  assert.equal(parseOrgChartCsv(csv(text.replace('Ops,Juan Pérez,3', 'Ops,1,3'))).ok, true);
});

test('un mismo cargo con jefaturas distintas es error (no se adivina)', () => {
  const text = `nombre,cargo,area,jefe_directo
Ana,Gerente,Gerencia,
Pedro,Jefe turno A,Ops,Ana
Rosa,Jefe turno B,Ops,Ana
Luis,Técnico,Ops,Pedro
Marta,Técnico,Ops,Rosa
`;
  const result = parseOrgChartCsv(csv(text));
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.errors[0].message, /depende de jefaturas distintas/);
    assert.deepEqual(result.errors[0].lines, [5, 6]);
  }
});

test('persona y jefe con el mismo cargo y área es error', () => {
  const text = 'nombre,cargo,area,jefe_directo\nAna,Técnico,Ops,\nLuis,Técnico,Ops,Ana\n';
  const result = parseOrgChartCsv(csv(text));
  assert.equal(result.ok, false);
});

test('ciclo de jefaturas entre cargos', () => {
  const text = 'nombre,cargo,area,jefe_directo\nAna,Cargo A,Ops,Luis\nLuis,Cargo B,Ops,Ana\n';
  const result = parseOrgChartCsv(csv(text));
  assert.equal(result.ok, false);
  if (!result.ok) {
    const cycles = result.errors.filter((e) => /ciclo/.test(e.message));
    assert.equal(cycles.length, 1, 'el ciclo se informa una sola vez');
  }
});

test('una persona no puede ser su propio jefe', () => {
  const { errors } = buildPlan(readRows('nombre,cargo,area,jefe_directo\nAna,Gerente,Gerencia,Ana\n').rows);
  assert.match(errors[0].message, /propio jefe/);
});

test('normalizeKey ignora mayúsculas, tildes y espacios', () => {
  assert.equal(normalizeKey('  Mantención   PLANTA '), 'mantencion planta');
});

test('generateCode crea códigos sin repetir los ya usados', () => {
  const taken = new Set(['OPERACIONES']);
  assert.equal(generateCode('Operaciones', taken), 'OPERACIONES-2');
  assert.equal(generateCode('Operaciones', taken), 'OPERACIONES-3');
  assert.equal(generateCode('Mantención Planta', taken), 'MANTENCION-PLANTA');
  assert.ok(generateCode('x'.repeat(100), taken).length <= 40);
});
