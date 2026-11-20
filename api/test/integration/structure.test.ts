// Pruebas de integración de la estructura: organigrama con cargos vacantes y perfiles de cargo desde CSV.
// La API completa contra PostgreSQL en memoria (PGlite), con su propia base (no comparte datos con api.test.ts).
// Nunca llama a una IA real. Ejecutar con: pnpm test:integration (en la carpeta api).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { makePdf } from '../helpers/pdf';
import { startEnvironment, type TestEnvironment } from './environment';

let env: TestEnvironment;

before(async () => {
  env = await startEnvironment({ provider: 'gemini' });
});

after(async () => {
  await env?.stop();
});

type Json = Record<string, unknown> & { [key: string]: any }; // eslint-disable-line @typescript-eslint/no-explicit-any

async function call(method: string, path: string, body?: unknown): Promise<{ status: number; data: Json }> {
  const response = await fetch(`${env.apiUrl}${path}`, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, data: text ? (JSON.parse(text) as Json) : {} };
}

async function uploadCsv(path: string, text: string): Promise<{ status: number; data: Json }> {
  const form = new FormData();
  form.append('file', new Blob([Buffer.from(text, 'utf8')]), 'archivo.csv');
  const response = await fetch(`${env.apiUrl}${path}`, { method: 'POST', body: form });
  return { status: response.status, data: (await response.json()) as Json };
}

// Organigrama de prueba: faltan el jefe de postventa y el coordinador de proyectos (filas sin nombre).
const ORG_CHART = `nombre;cargo;area;jefe_directo;codigo;dotacion_objetivo
Ana Rojas;Gerente general;Gerencia;;;
Luis Vega;Técnico senior;Postventa;Ana Rojas;;2
Marta Díaz;Técnico senior;Postventa;Ana Rojas;;2
Rosa Pinto;Técnico junior;Postventa;Ana Rojas;;
;Jefe de postventa;Postventa;Ana Rojas;;
;Coordinador de proyectos;Proyectos;Ana Rojas;;
`;

const PROFILES = `cargo;area;competencia;categoria;nivel_minimo;obligatoria;peso
Jefe de postventa;Postventa;Mantención de compresores;tecnica;4;si;2
Jefe de postventa;Postventa;Liderazgo de equipos;blanda;3;si;1
Jefe de postventa;Postventa;SAP PM;tecnica;2;no;1
Técnico senior;Postventa;mantencion de COMPRESORES;blanda;3;;
`;

const positionByTitle = async (title: string) =>
  ((await call('GET', '/positions')).data as unknown as Json[]).find((p) => p.title === title)!;

test('organigrama con filas sin nombre: crea los cargos vacantes sin personas', async () => {
  const applied = await uploadCsv('/org-chart/import?mode=apply', ORG_CHART);
  assert.equal(applied.data.saved, true, JSON.stringify(applied.data));
  assert.equal(applied.data.summary.employees.created.length, 4);
  assert.equal(applied.data.summary.positions.created.length, 5);

  const { data } = await call('GET', '/positions/org-chart');
  assert.deepEqual(data.totals, { positions: 5, people: 4, vacancies: 2, overstaffed: 0 });
  const jefe = (data.positions as Json[]).find((p) => p.title === 'Jefe de postventa')!;
  assert.deepEqual([jefe.currentHeadcount, jefe.targetHeadcount, jefe.vacancies], [0, 1, 1]);

  // Reimportar no duplica cargos ni personas.
  const again = await uploadCsv('/org-chart/import?mode=apply', ORG_CHART);
  assert.equal(again.data.summary.positions.created.length, 0);
  assert.equal(again.data.summary.employees.unchanged, 4);
});

test('perfiles de cargo: la vista previa no guarda; aplicar reemplaza los requisitos de los cargos del archivo', async () => {
  const preview = await uploadCsv('/position-profiles/import?mode=preview', PROFILES);
  assert.equal(preview.status, 201);
  assert.equal(preview.data.ok, true, JSON.stringify(preview.data));
  assert.equal(preview.data.saved, false);
  assert.deepEqual(preview.data.summary.createdSkills, ['Mantención de compresores', 'Liderazgo de equipos', 'SAP PM']);
  assert.equal(preview.data.summary.positionsNotInFile, 3);
  // "mantencion de COMPRESORES" del técnico es la misma competencia nueva que la del jefe: se crea una sola vez,
  // como técnica (la primera fila), y se avisa que la fila 5 dice "blanda".
  assert.deepEqual((preview.data.warnings as Json[]).map((w) => w.lines), [[5]]);
  assert.match((preview.data.warnings as Json[])[0].message, /se creará como competencia técnica \(fila 2\); esta fila dice blanda/);
  const jefe = await positionByTitle('Jefe de postventa');
  assert.deepEqual((await call('GET', `/positions/${jefe.id}/skills`)).data, [], 'la vista previa no guarda');

  const applied = await uploadCsv('/position-profiles/import?mode=apply', PROFILES);
  assert.equal(applied.data.saved, true, JSON.stringify(applied.data));
  const requirements = (await call('GET', `/positions/${jefe.id}/skills`)).data as unknown as Json[];
  assert.deepEqual(
    requirements.map((r) => [r.name, r.requiredLevel, r.isMandatory, r.weight]),
    [
      ['Liderazgo de equipos', 3, true, 1],
      ['Mantención de compresores', 4, true, 2],
      ['SAP PM', 2, false, 1],
    ],
  );
  const tecnico = await positionByTitle('Técnico senior');
  const tecnicoRequirements = (await call('GET', `/positions/${tecnico.id}/skills`)).data as unknown as Json[];
  assert.deepEqual(tecnicoRequirements.map((r) => [r.name, r.category]), [['Mantención de compresores', 'TECHNICAL']]);
});

test('perfiles de cargo: categoría distinta a la del catálogo es advertencia; se quitan los requisitos que no vienen', async () => {
  const text = `cargo;area;competencia;categoria;nivel_minimo
Jefe de postventa;Postventa;Mantención de compresores;blanda;5
`;
  const preview = await uploadCsv('/position-profiles/import?mode=preview', text);
  assert.equal(preview.data.ok, true);
  assert.equal((preview.data.warnings as Json[]).length, 1);
  assert.match((preview.data.warnings as Json[])[0].message, /ya existe en el catálogo como competencia técnica/);
  assert.deepEqual(preview.data.summary.positions[0].removed, ['Liderazgo de equipos', 'SAP PM']);
  assert.equal(preview.data.summary.positions[0].previousCount, 3);
});

test('perfiles de cargo: cargo inexistente o competencia nueva sin categoría no guardan nada', async () => {
  const text = `cargo;area;competencia;categoria
Jefe de bodega;Logística;Inventarios;tecnica
Jefe de postventa;Postventa;Negociación;
`;
  const result = await uploadCsv('/position-profiles/import?mode=apply', text);
  assert.equal(result.data.ok, false);
  assert.equal(result.data.saved, false);
  const messages = (result.data.errors as Json[]).map((e) => e.message as string);
  assert.match(messages[0], /"Jefe de bodega" de "Logística" no existe/);
  assert.match(messages[1], /"Negociación" no existe en el catálogo: indica su categoria/);

  const jefe = await positionByTitle('Jefe de postventa');
  assert.equal(((await call('GET', `/positions/${jefe.id}/skills`)).data as unknown as Json[]).length, 3);
});

test('perfiles de cargo: sin modo o sin archivo responde 400', async () => {
  assert.equal((await uploadCsv('/position-profiles/import', PROFILES)).status, 400);
  const response = await fetch(`${env.apiUrl}/position-profiles/import?mode=preview`, { method: 'POST' });
  assert.equal(response.status, 400);
});

// CV de prueba: contiene los 3 fragmentos que devuelve el Gemini simulado (environment.ts), así no se descarta ninguno.
const CV_LINES = [
  'Matias Herrera Soto',
  'Experiencia en mantencion de compresores industriales',
  'Manejo de SAP PM para ordenes de trabajo',
  'Dirigio un equipo de 40 personas',
];

async function uploadCv(): Promise<string> {
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(makePdf(CV_LINES))]), 'cv.pdf');
  form.append('type', 'CV');
  const response = await fetch(`${env.apiUrl}/documents`, { method: 'POST', body: form });
  const data = (await response.json()) as Json;
  assert.equal(response.status, 201, JSON.stringify(data));
  return data.id as string;
}

async function waitForAnalysis(documentId: string): Promise<Json> {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const { data } = await call('GET', `/documents/${documentId}/extraction`);
    if (data.status === 'COMPLETED' || data.status === 'FAILED') return data;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error('El análisis no terminó en 20 s.');
}

let cvDocumentId = '';

test('revisión: cada propuesta pendiente indica si ya está en el catálogo o a cuál se parece (sin IA)', async () => {
  env.setAiMode('ok');
  cvDocumentId = await uploadCv();
  const extraction = await waitForAnalysis(cvDocumentId);
  assert.equal(extraction.status, 'COMPLETED', JSON.stringify(extraction));
  const byName = (name: string) => (extraction.proposals as Json[]).find((p) => p.name === name)!;

  // Mismo nombre que un requisito importado: cuenta tal cual.
  assert.equal(byName('Mantención de compresores').catalogMatch.exact.name, 'Mantención de compresores');
  assert.equal(byName('SAP PM').catalogMatch.exact.name, 'SAP PM');
  // "Liderazgo" no es igual a "Liderazgo de equipos": solo se sugiere; la persona decide.
  const liderazgo = byName('Liderazgo').catalogMatch;
  assert.equal(liderazgo.exact, null);
  assert.deepEqual(
    (liderazgo.similar as Json[]).map((s) => [s.name, s.category, s.score]),
    [['Liderazgo de equipos', 'BEHAVIORAL', 0.5]],
  );
});
