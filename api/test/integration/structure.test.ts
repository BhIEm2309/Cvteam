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

// ---------- Diagnóstico (reglas, sin IA) ----------

let jefeRecommendationId = '';

test('diagnóstico: antes de ejecutarlo no hay ninguno', async () => {
  const { status, data } = await call('GET', '/diagnostics/latest');
  assert.equal(status, 200);
  assert.equal(data.run, null);
});

test('diagnóstico: con el CV revisado (usando el nombre del catálogo) propone a Matías para la vacante de jefe', async () => {
  // Quien revisa crea a la persona y usa "Liderazgo de equipos" (la sugerencia del catálogo) en vez de "Liderazgo".
  const extraction = (await call('GET', `/documents/${cvDocumentId}/extraction`)).data;
  const id = (name: string) => (extraction.proposals as Json[]).find((p) => p.name === name)!.id as string;
  const review = await call('POST', `/documents/${cvDocumentId}/extraction/review`, {
    newEmployeeName: 'Matías Herrera',
    decisions: [
      { proposalId: id('Mantención de compresores'), action: 'confirm', name: 'Mantención de compresores', category: 'TECHNICAL', level: 4 },
      { proposalId: id('SAP PM'), action: 'confirm', name: 'SAP PM', category: 'TECHNICAL', level: null },
      { proposalId: id('Liderazgo'), action: 'confirm', name: 'Liderazgo de equipos', category: 'BEHAVIORAL', level: 3 },
    ],
  });
  assert.equal(review.status, 200, JSON.stringify(review.data));

  const { status, data } = await call('POST', '/diagnostics');
  assert.equal(status, 201, JSON.stringify(data));
  assert.equal(data.created, true);
  const run = data.run as Json;
  assert.equal(run.isOutdated, false);
  assert.equal(run.rulesetVersion, 'diagnostico-reglas-v1');
  assert.deepEqual(
    { vacancies: run.summary.vacancies, withoutData: run.summary.peopleWithoutData, withoutPosition: run.summary.peopleWithoutPosition, moves: run.summary.reassignmentProposals },
    { vacancies: 2, withoutData: 4, withoutPosition: 1, moves: 1 },
  );

  const findings = run.findings as Json[];
  const byTitle = (title: string) => findings.find((f) => f.title === title)!;
  // Jefe de postventa: (2·1 + 1·1 + 1·0,5) / 4 = 88 % (SAP PM sin nivel cuenta la mitad) → Óptimo → candidato.
  const jefe = byTitle('Rol sin personas: Jefe de postventa');
  assert.equal(jefe.type, 'UNFILLED_POSITION');
  assert.equal(jefe.severity, 'HIGH');
  assert.equal(jefe.recommendations.length, 1);
  const move = jefe.recommendations[0];
  assert.deepEqual([move.metadata.kind, move.metadata.employeeName, move.metadata.fitPercent, move.status], ['reasignar', 'Matías Herrera', 88, 'PROPOSED']);
  jefeRecommendationId = move.id as string;

  // Coordinador de proyectos no tiene perfil: se pide definirlo en vez de inventar candidatos.
  assert.equal(byTitle('Rol sin personas: Coordinador de proyectos').recommendations[0].metadata.kind, 'definir-perfil');
  // Técnicos sin CV revisado: falta información (no se declaran en desajuste).
  assert.equal(byTitle('Sin competencias confirmadas: Luis Vega').type, 'INSUFFICIENT_DATA');
  // La persona sin cargo trae como evidencia los fragmentos de su CV.
  const matias = byTitle('Sin cargo asignado: Matías Herrera');
  assert.deepEqual((matias.evidence as Json[]).map((e) => e.excerpt).sort(), [
    'Dirigio un equipo de 40 personas',
    'Experiencia en mantencion de compresores industriales',
    'Manejo de SAP PM',
  ]);
});

test('diagnóstico: ejecutarlo de nuevo sin cambios no duplica; con cambios queda desactualizado', async () => {
  const first = (await call('GET', '/diagnostics/latest')).data.run as Json;
  const again = await call('POST', '/diagnostics');
  assert.equal(again.data.created, false);
  assert.equal(again.data.run.id, first.id);

  // Cambiar la dotación de un cargo cambia los datos: el diagnóstico guardado queda desactualizado.
  const tecnico = await positionByTitle('Técnico senior');
  assert.equal((await call('PATCH', `/positions/${tecnico.id}`, { targetHeadcount: 3 })).status, 200);
  assert.equal((await call('GET', '/diagnostics/latest')).data.run.isOutdated, true);
  const second = await call('POST', '/diagnostics');
  assert.equal(second.data.created, true);
  assert.notEqual(second.data.run.id, first.id);
  assert.equal(second.data.run.summary.vacancies, 3);

  // Volver a los datos de antes muestra el diagnóstico que les corresponde (no el más nuevo).
  assert.equal((await call('PATCH', `/positions/${tecnico.id}`, { targetHeadcount: 2 })).status, 200);
  const latest = (await call('GET', '/diagnostics/latest')).data.run as Json;
  assert.equal(latest.id, first.id);
  assert.equal(latest.isOutdated, false);
});

test('diagnóstico: una persona acepta o rechaza una recomendación una sola vez; no cambia el organigrama', async () => {
  assert.equal((await call('PATCH', `/diagnostics/recommendations/${jefeRecommendationId}`, { status: 'APPLIED' })).status, 400);
  assert.equal((await call('PATCH', '/diagnostics/recommendations/no-es-uuid', { status: 'ACCEPTED' })).status, 400);
  assert.equal((await call('PATCH', '/diagnostics/recommendations/44444444-4444-4444-8444-444444444444', { status: 'ACCEPTED' })).status, 404);

  const accepted = await call('PATCH', `/diagnostics/recommendations/${jefeRecommendationId}`, { status: 'ACCEPTED', notes: 'Entrevistar' });
  assert.equal(accepted.status, 200, JSON.stringify(accepted.data));
  assert.deepEqual([accepted.data.status, accepted.data.decisionNotes], ['ACCEPTED', 'Entrevistar']);
  assert.equal((await call('PATCH', `/diagnostics/recommendations/${jefeRecommendationId}`, { status: 'REJECTED' })).status, 409);

  // Aceptar no asigna el cargo: el jefe de postventa sigue vacante.
  const chart = (await call('GET', '/positions/org-chart')).data;
  assert.equal((chart.positions as Json[]).find((p) => p.title === 'Jefe de postventa')!.currentHeadcount, 0);
});
