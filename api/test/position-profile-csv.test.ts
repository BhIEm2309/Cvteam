// Pruebas de la lectura y validación del CSV de perfiles de cargo (no usan base de datos).
// Ejecutar con: pnpm test (en la carpeta api).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { OrgChartFileError } from '../src/modules/org-chart-import/org-chart-csv';
import { parsePositionProfileCsv, readProfileRows } from '../src/modules/skills/position-profile-csv';

const csv = (text: string) => Buffer.from(text, 'utf8');

const VALID = `cargo;area;competencia;categoria;nivel_minimo;obligatoria;peso
Jefe de postventa;Postventa;Mantención de compresores;tecnica;4;si;2
Jefe de postventa;Postventa;Liderazgo de equipos;blanda;3;;
Jefe de postventa;Postventa;SAP PM;Técnica;2;no;1,5
Técnico senior;Postventa;Mantención de compresores;;3;;
`;

test('perfil válido: agrupa por cargo y aplica valores por defecto', () => {
  const result = parsePositionProfileCsv(csv(VALID));
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.rowCount, 4);
  assert.deepEqual(result.plan.positions.map((p) => [p.title, p.requirements.length]), [
    ['Jefe de postventa', 3],
    ['Técnico senior', 1],
  ]);

  const [mantencion, liderazgo, sap] = result.plan.positions[0].requirements;
  assert.deepEqual(
    { category: mantencion.category, level: mantencion.requiredLevel, mandatory: mantencion.isMandatory, weight: mantencion.weight },
    { category: 'TECHNICAL', level: 4, mandatory: true, weight: 2 },
  );
  // Vacíos: obligatoria por defecto, peso 1.
  assert.deepEqual([liderazgo.category, liderazgo.isMandatory, liderazgo.weight], ['BEHAVIORAL', true, 1]);
  // "Técnica" con tilde y mayúscula, "no" y coma decimal.
  assert.deepEqual([sap.category, sap.isMandatory, sap.weight], ['TECHNICAL', false, 1.5]);
  // Sin categoría: se resuelve con el catálogo (el servicio exige categoría solo si la competencia es nueva).
  assert.equal(result.plan.positions[1].requirements[0].category, null);
});

test('mismo cargo con distinta escritura (mayúsculas, tildes) es un solo cargo', () => {
  const result = parsePositionProfileCsv(csv('cargo,area,competencia\nTécnico senior,Postventa,A\ntecnico SENIOR,postventa,B\n'));
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.plan.positions.length, 1);
});

test('valores inválidos: se informan todos los de la fila, con su número', () => {
  const result = parsePositionProfileCsv(csv('cargo,area,competencia,categoria,nivel_minimo,obligatoria,peso\nJefe,Postventa,SAP,dura,7,quizás,0\n'));
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.deepEqual(result.errors[0].lines, [2]);
  for (const expected of [/categoria debe ser/, /nivel_minimo debe ser un entero de 1 a 5/, /obligatoria debe ser "si" o "no"/, /peso debe ser un número mayor que 0/]) {
    assert.match(result.errors[0].message, expected);
  }
});

test('faltan datos obligatorios en una fila', () => {
  const result = parsePositionProfileCsv(csv('cargo,area,competencia\nJefe,,SAP\n'));
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.errors[0].message, /Falta area/);
});

test('competencia repetida en el mismo cargo es error (aunque cambie la escritura)', () => {
  const result = parsePositionProfileCsv(csv('cargo,area,competencia\nJefe,Postventa,SAP PM\nJefe,Postventa,sap  pm\nOtro,Postventa,SAP PM\n'));
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.errors.length, 1);
  assert.deepEqual(result.errors[0].lines, [2, 3]);
  assert.match(result.errors[0].message, /aparece 2 veces/);
});

test('peso: acepta hasta 2 decimales y rechaza más', () => {
  assert.equal(parsePositionProfileCsv(csv('cargo,area,competencia,peso\nJefe,P,A,2.25\n')).ok, true);
  assert.equal(parsePositionProfileCsv(csv('cargo,area,competencia,peso\nJefe,P,A,2.255\n')).ok, false);
});

test('rechaza archivos sin columnas obligatorias o sin filas', () => {
  assert.throws(() => readProfileRows('cargo,area\nJefe,Postventa\n'), /Faltan columnas obligatorias: competencia/);
  assert.throws(() => readProfileRows('cargo,area,competencia\n'), /solo tiene encabezados/);
  assert.throws(() => readProfileRows(''), OrgChartFileError);
});

// En Docker solo se monta la carpeta api/: si docs/ no está, la prueba se omite.
const TEMPLATE_PATH = join(__dirname, '..', '..', 'docs', 'plantilla-perfiles-cargo.csv');

test('la plantilla de perfiles de docs/ es válida', { skip: existsSync(TEMPLATE_PATH) ? false : 'no se encontró docs/ (por ejemplo, dentro de Docker)' }, () => {
  const result = parsePositionProfileCsv(readFileSync(TEMPLATE_PATH));
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.plan.positions.map((p) => [p.title, p.requirements.length]), [
      ['Jefe de postventa', 3],
      ['Técnico senior', 2],
    ]);
  }
});
