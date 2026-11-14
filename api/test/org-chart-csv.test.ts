// Pruebas de la lectura y validación del CSV de organigrama (no usan base de datos).
// Ejecutar con: pnpm test (en la carpeta api).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
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
  const text = '\ufeffNombre;Cargo;Área;Jefe directo\nAna Rojas;Gerente;Gerencia;\nLuis Vega;Técnico;Operaciones;ana rojas\n';
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

// ---------- Dotación objetivo ----------

const position = (result: ReturnType<typeof parseOrgChartCsv>, title: string) =>
  result.ok ? result.plan.positions.find((p) => p.title === title) : undefined;

test('dotación por defecto: cantidad de personas del archivo con ese cargo', () => {
  const result = parseOrgChartCsv(csv(VALID));
  assert.equal(result.ok, true);
  assert.equal(position(result, 'Técnico senior')?.targetHeadcount, 2);
  assert.equal(position(result, 'Técnico senior')?.declaredHeadcount, null);
  assert.equal(position(result, 'Gerente general')?.targetHeadcount, 1);
  if (result.ok) assert.deepEqual(result.warnings, []);
});

test('dotacion_objetivo: se usa el valor declarado (en una o en varias filas del cargo)', () => {
  const text = `nombre,cargo,area,jefe_directo,dotacion_objetivo
Ana,Gerente,Gerencia,,
Luis,Técnico,Ops,Ana,5
Marta,Técnico,Ops,Ana,
Rosa,Analista,Ops,Ana,2
Juan,Analista,Ops,Ana,2
`;
  const result = parseOrgChartCsv(csv(text));
  assert.equal(result.ok, true);
  assert.equal(position(result, 'Técnico')?.targetHeadcount, 5);
  assert.equal(position(result, 'Técnico')?.personCount, 2);
  assert.equal(position(result, 'Analista')?.targetHeadcount, 2);
  assert.equal(position(result, 'Gerente')?.targetHeadcount, 1);
  if (result.ok) assert.deepEqual(result.warnings, []);
});

test('dotacion_objetivo: también se acepta el encabezado "Dotación"', () => {
  const result = parseOrgChartCsv(csv('nombre;cargo;área;Dotación\nAna;Gerente;Gerencia;4\n'));
  assert.equal(position(result, 'Gerente')?.targetHeadcount, 4);
});

test('dotacion_objetivo: debe ser un entero mayor o igual a 1', () => {
  for (const value of ['0', '-1', '2.5', '2,5', 'tres', '10001']) {
    const result = parseOrgChartCsv(csv(`nombre;cargo;area;dotacion_objetivo\nAna;Gerente;Gerencia;${value}\n`));
    assert.equal(result.ok, false, `"${value}" debería ser error`);
    if (!result.ok) {
      assert.deepEqual(result.errors[0].lines, [2]);
      assert.match(result.errors[0].message, /entero entre 1 y 10000/);
    }
  }
});

test('dotacion_objetivo: valores distintos para el mismo cargo es error', () => {
  const text = 'nombre,cargo,area,dotacion_objetivo\nLuis,Técnico,Ops,3\nMarta,Técnico,Ops,4\n';
  const result = parseOrgChartCsv(csv(text));
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.deepEqual(result.errors[0].lines, [2, 3]);
    assert.match(result.errors[0].message, /dotaciones objetivo distintas/);
  }
});

test('dotacion_objetivo menor que las personas asignadas: advertencia, no error', () => {
  const text = 'nombre,cargo,area,dotacion_objetivo\nLuis,Técnico,Ops,1\nMarta,Técnico,Ops,\nRosa,Técnico,Ops,\n';
  const result = parseOrgChartCsv(csv(text));
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(position(result, 'Técnico')?.targetHeadcount, 1);
  assert.equal(result.warnings.length, 1);
  assert.deepEqual(result.warnings[0].lines, [2, 3, 4]);
  assert.match(result.warnings[0].message, /dotación objetivo 1, pero el archivo le asigna 3 personas/);
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

// En Docker solo se monta la carpeta api/: si docs/ no está, la prueba se omite.
const TEMPLATE_PATH = join(__dirname, '..', '..', 'docs', 'plantilla-organigrama.csv');

test('la plantilla de docs/ es válida', { skip: existsSync(TEMPLATE_PATH) ? false : 'no se encontró docs/ (por ejemplo, dentro de Docker)' }, () => {
  const template = readFileSync(TEMPLATE_PATH);
  const result = parseOrgChartCsv(template);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.rowCount, 4);
    // La plantilla muestra la columna opcional: 2 técnicos con dotación objetivo 3 (una vacante).
    assert.equal(position(result, 'Técnico senior')?.targetHeadcount, 3);
    assert.equal(position(result, 'Jefe de postventa')?.targetHeadcount, 1);
  }
});
