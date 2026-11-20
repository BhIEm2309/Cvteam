// Pruebas de las sugerencias de competencias equivalentes (no usan base de datos ni IA).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchCatalog, skillSimilarity, skillTokens } from '../src/modules/skills/skill-similarity';

const CATALOG = [
  { id: '1', name: 'Gestión de proyectos', category: 'TECHNICAL' as const },
  { id: '2', name: 'SAP Plant Maintenance', category: 'TECHNICAL' as const },
  { id: '3', name: 'Mantención de compresores', category: 'TECHNICAL' as const },
  { id: '4', name: 'Liderazgo de equipos', category: 'BEHAVIORAL' as const },
  { id: '5', name: 'Comunicación efectiva', category: 'BEHAVIORAL' as const },
];

test('palabras: sin tildes, mayúsculas, signos ni palabras vacías', () => {
  assert.deepEqual(skillTokens('Gestión de Proyectos (PMBOK)'), ['gestion', 'proyectos', 'pmbok']);
  assert.deepEqual(skillTokens('C# y C++'), ['c#', 'c++']);
});

test('mismo nombre escrito distinto = 1', () => {
  assert.equal(skillSimilarity('gestion de PROYECTOS', 'Gestión de proyectos'), 1);
});

test('casos que sí se sugieren', () => {
  // Nombre más específico.
  assert.ok(skillSimilarity('Gestión de proyectos PMBOK', 'Gestión de proyectos') >= 0.5);
  // Sigla.
  assert.equal(skillSimilarity('SAP PM', 'SAP Plant Maintenance'), 1);
  // Variantes de la misma palabra.
  assert.equal(skillSimilarity('Mantenimiento de compresor', 'Mantención de compresores'), 1);
});

test('casos que no se sugieren', () => {
  assert.ok(skillSimilarity('Liderazgo de equipos', 'Gestión de proyectos') < 0.5);
  assert.ok(skillSimilarity('Comunicación efectiva', 'Mantención de compresores') < 0.5);
  // Una sola palabra en común entre nombres largos no basta.
  assert.ok(skillSimilarity('Mantención eléctrica de tableros', 'Mantención de compresores') < 0.5);
});

test('matchCatalog: coincidencia exacta no trae sugerencias', () => {
  const match = matchCatalog('mantencion de compresores', CATALOG);
  assert.equal(match.exact?.id, '3');
  assert.deepEqual(match.similar, []);
});

test('matchCatalog: sugerencias ordenadas, como máximo 3, y nada si no hay parecidas', () => {
  const match = matchCatalog('Gestión de proyectos PMBOK', CATALOG);
  assert.equal(match.exact, null);
  assert.deepEqual(match.similar.map((s) => s.name), ['Gestión de proyectos']);
  assert.equal(match.similar[0].score, 0.67);

  assert.deepEqual(matchCatalog('SAP PM', CATALOG).similar.map((s) => [s.name, s.score]), [['SAP Plant Maintenance', 1]]);
  assert.deepEqual(matchCatalog('Soldadura MIG', CATALOG), { exact: null, similar: [] });
});
