// Pruebas de integración de la API contra PostgreSQL 17 en memoria (PGlite) y una API de Anthropic simulada.
// Ejecutar con: pnpm test:integration (en la carpeta api). Compila la API antes de probarla.
// Las pruebas corren en orden y comparten la base: cada una parte del estado que dejó la anterior.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { makePdf } from '../helpers/pdf';
import { startEnvironment, type TestEnvironment } from './environment';

let env: TestEnvironment;
let prisma: PrismaClient;

const CV_LINES = [
  'Juan Contreras Rojas',
  'Tecnico electromecanico, Region de Coquimbo',
  'Experiencia en mantencion de compresores industriales',
  'Manejo de SAP PM para ordenes de trabajo',
];

before(async () => {
  env = await startEnvironment();
  prisma = new PrismaClient({ datasources: { db: { url: env.databaseUrl } } });
});

after(async () => {
  await prisma?.$disconnect();
  await env?.stop();
});

// ---------- Ayudas ----------

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

async function upload(path: string, content: Buffer, fileName: string, extra: Record<string, string> = {}) {
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(content)]), fileName);
  for (const [key, value] of Object.entries(extra)) form.append(key, value);
  const response = await fetch(`${env.apiUrl}${path}`, { method: 'POST', body: form });
  return { status: response.status, data: (await response.json()) as Json };
}

async function uploadCv(lines = CV_LINES, type = 'CV'): Promise<string> {
  const { status, data } = await upload('/documents', makePdf(lines), 'cv.pdf', { type });
  assert.equal(status, 201, JSON.stringify(data));
  return data.id as string;
}

// Espera a que el análisis del CV termine (Analizado o Error).
async function waitForAnalysis(documentId: string): Promise<Json> {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const { data } = await call('GET', `/documents/${documentId}/extraction`);
    if (data.status === 'COMPLETED' || data.status === 'FAILED') return data;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error('El análisis no terminó en 20 s.');
}

async function employeeId(fullName: string): Promise<string> {
  const { data } = await call('GET', '/employees');
  return (data as unknown as Json[]).find((employee) => employee.fullName === fullName)!.id;
}

const proposalId = (extraction: Json, name: string) => (extraction.proposals as Json[]).find((p) => p.name === name)!.id as string;

// ---------- Base y organigrama ----------

test('la API responde y la base tiene la organización de demostración', async () => {
  const { status } = await call('GET', '/health');
  assert.equal(status, 200);
  const { data } = await call('GET', '/organizations');
  assert.equal((data as unknown as Json[])[0].name, 'Empresa Demo');
});

test('importar organigrama: la vista previa no guarda y aplicar dos veces no duplica', async () => {
  const csv = readFileSync(join(__dirname, '..', '..', '..', 'docs', 'plantilla-organigrama.csv'));
  const preview = await upload('/org-chart/import?mode=preview', csv, 'organigrama.csv');
  assert.equal(preview.data.saved, false);
  assert.equal((await call('GET', '/employees')).data.length, 0);

  const first = await upload('/org-chart/import?mode=apply', csv, 'organigrama.csv');
  assert.equal(first.data.saved, true);
  const second = await upload('/org-chart/import?mode=apply', csv, 'organigrama.csv');
  assert.equal(second.data.summary.employees.unchanged, 4);
  assert.equal((await call('GET', '/employees')).data.length, 4);
});

test('importar organigrama: guarda la dotación objetivo y avisa cuando es menor que las personas', async () => {
  const template = readFileSync(join(__dirname, '..', '..', '..', 'docs', 'plantilla-organigrama.csv'));
  const headcount = async (title: string) =>
    ((await call('GET', '/positions')).data as unknown as Json[]).find((p) => p.title === title)!.targetHeadcount;
  // La plantilla declara 3 para "Técnico senior"; los demás cargos quedan con su cantidad de personas.
  assert.equal(await headcount('Técnico senior'), 3);
  assert.equal(await headcount('Gerente general'), 1);

  const lower = Buffer.from(template.toString('utf8').replace(/;3(\r?\n)/g, ';1$1'), 'utf8');
  const preview = await upload('/org-chart/import?mode=preview', lower, 'organigrama.csv');
  assert.equal(preview.data.ok, true);
  assert.equal((preview.data.warnings as Json[]).length, 1);
  assert.match((preview.data.warnings as Json[])[0].message, /sobredotación/);
  assert.deepEqual(preview.data.summary.positions.headcountChanged, [
    { title: 'Técnico senior', department: 'Postventa', from: 3, to: 1 },
  ]);
  assert.equal(await headcount('Técnico senior'), 3, 'la vista previa no guarda');

  const applied = await upload('/org-chart/import?mode=apply', lower, 'organigrama.csv');
  assert.equal(applied.data.saved, true);
  assert.equal(await headcount('Técnico senior'), 1);

  // Se deja como estaba para las pruebas siguientes.
  await upload('/org-chart/import?mode=apply', template, 'organigrama.csv');
  assert.equal(await headcount('Técnico senior'), 3);
});

test('organigrama actual: jerarquía de cargos, personas de hoy y vacantes según la dotación objetivo', async () => {
  const { status, data } = await call('GET', '/positions/org-chart');
  assert.equal(status, 200);
  assert.equal(data.organizationName, 'Empresa Demo');
  assert.deepEqual(data.totals, { positions: 3, people: 4, vacancies: 1, overstaffed: 0 });

  const positions = data.positions as Json[];
  const byTitle = (title: string) => positions.find((p) => p.title === title)!;
  const gerente = byTitle('Gerente general');
  const jefe = byTitle('Jefe de postventa');
  const tecnico = byTitle('Técnico senior');
  assert.equal(gerente.parentPositionId, null);
  assert.equal(jefe.parentPositionId, gerente.id);
  assert.equal(tecnico.parentPositionId, jefe.id);
  // La plantilla declara dotación 3 para 2 técnicos: 1 vacante.
  assert.deepEqual([tecnico.targetHeadcount, tecnico.currentHeadcount, tecnico.vacancies], [3, 2, 1]);
  assert.deepEqual((tecnico.people as Json[]).map((p) => p.fullName), ['Luis Vega', 'Marta Díaz']);
});

test('áreas: rechaza un ciclo A → B → A', async () => {
  const departments = (await call('GET', '/departments')).data as unknown as Json[];
  const gerencia = departments.find((d) => d.name === 'Gerencia')!.id;
  const postventa = departments.find((d) => d.name === 'Postventa')!.id;
  assert.equal((await call('PATCH', `/departments/${postventa}`, { parentDepartmentId: gerencia })).status, 200);
  const cycle = await call('PATCH', `/departments/${gerencia}`, { parentDepartmentId: postventa });
  assert.equal(cycle.status, 400);
  assert.match(cycle.data.message, /ciclo/);
});

// ---------- Análisis de CVs ----------

test('un CV se analiza, guarda propuestas y descarta el fragmento inventado', async () => {
  env.setAiMode('ok');
  const extraction = await waitForAnalysis(await uploadCv());
  assert.equal(extraction.status, 'COMPLETED');
  assert.deepEqual((extraction.proposals as Json[]).map((p) => p.name).sort(), ['Mantención de compresores', 'SAP PM']);
  assert.equal(extraction.run.discarded[0].name, 'Liderazgo');
  assert.equal(extraction.run.model, 'claude-haiku-5-5');
  assert.equal(extraction.run.requestedModel, 'claude-haiku-5-5');

  // La solicitud a la IA lleva las opciones verificadas en la documentación oficial.
  const request = env.aiRequests.at(-1)!;
  assert.equal(request.model, 'claude-haiku-5-5');
  assert.equal(request.fallbacks, 'default');
  assert.equal((request.output_config as Json).effort, 'medium');
});

test('datos personales: la IA no recibe RUT, correo, teléfono ni dirección, y no se guardan', async () => {
  env.setAiMode('ok');
  const personal = ['RUT: 12.345.678-9', 'Correo: juan.contreras@correo.cl', 'Celular: +56 9 1234 5678', 'Direccion: Los Aromos 1234, La Serena'];
  const secrets = ['12.345.678-9', 'juan.contreras@correo.cl', '1234 5678', 'Los Aromos'];
  const requestsBefore = env.aiRequests.length;
  const extraction = await waitForAnalysis(await uploadCv([...CV_LINES, ...personal]));
  assert.equal(extraction.status, 'COMPLETED');
  assert.deepEqual(extraction.run.redactions, { rut: 1, email: 1, phone: 1, address: 1 });

  // Lo que se envió a la IA.
  const sent = JSON.stringify(env.aiRequests.slice(requestsBefore));
  for (const secret of secrets) assert.ok(!sent.includes(secret), `la IA recibió "${secret}"`);
  assert.ok(sent.includes('[RUT]') && sent.includes('[CORREO]') && sent.includes('[TELÉFONO]') && sent.includes('[DIRECCIÓN]'));

  // Lo que quedó guardado en la base.
  const run = await prisma.extractionRun.findFirstOrThrow({
    where: { documentVersion: { documentId: extraction.documentId as string } },
    select: { extractedText: true },
  });
  for (const secret of secrets) assert.ok(!run.extractedText!.includes(secret), `se guardó "${secret}"`);

  // La verificación de fragmentos sigue funcionando sobre el texto ocultado.
  assert.equal((extraction.proposals as Json[]).length, 2);
});

test('si responde otro modelo (respaldo), se guarda el que respondió y se informa el pedido', async () => {
  env.setAiMode({ respondAs: 'claude-sonnet-5' });
  const extraction = await waitForAnalysis(await uploadCv());
  assert.equal(extraction.run.model, 'claude-sonnet-5');
  assert.equal(extraction.run.requestedModel, 'claude-haiku-5-5');
  env.setAiMode('ok');
});

test('errores de análisis con su código: PDF sin texto, clave inválida, rechazo, servicio caído', async () => {
  const cases: [FakeMode, string[] | null, string][] = [
    ['ok', ['CV'], 'PDF_SIN_TEXTO'],
    ['unauthorized', null, 'IA_CLAVE_INVALIDA'],
    ['refusal', null, 'IA_RECHAZO'],
    ['error500', null, 'IA_NO_DISPONIBLE'],
  ];
  for (const [mode, lines, code] of cases) {
    env.setAiMode(mode);
    const extraction = await waitForAnalysis(await uploadCv(lines ?? CV_LINES));
    assert.equal(extraction.status, 'FAILED', code);
    assert.equal(extraction.run.errorCode, code);
  }
  env.setAiMode('ok');
});
type FakeMode = Parameters<TestEnvironment['setAiMode']>[0];

test('analizar de nuevo: funciona si falló y responde 409 si ya se analizó', async () => {
  env.setAiMode('refusal');
  const documentId = await uploadCv();
  assert.equal((await waitForAnalysis(documentId)).status, 'FAILED');
  env.setAiMode('ok');
  assert.equal((await call('POST', `/documents/${documentId}/extraction`)).status, 201);
  assert.equal((await waitForAnalysis(documentId)).status, 'COMPLETED');
  assert.equal((await call('POST', `/documents/${documentId}/extraction`)).status, 409);
});

test('analizar de nuevo con el modelo alternativo: solo para ese CV y solo modelos permitidos', async () => {
  // Haiku rechaza el CV (no tiene respaldo automático): queda en error IA_RECHAZO, visible en la lista.
  env.setAiMode('refusal');
  const documentId = await uploadCv();
  assert.equal((await waitForAnalysis(documentId)).run.errorCode, 'IA_RECHAZO');
  const listed = ((await call('GET', '/documents')).data as unknown as Json[]).find((d) => d.id === documentId)!;
  assert.equal(listed.analysisErrorCode, 'IA_RECHAZO');

  // Un modelo que no está permitido se rechaza sin encolar nada.
  const invalid = await call('POST', `/documents/${documentId}/extraction`, { model: 'claude-fable-5-2' });
  assert.equal(invalid.status, 400);
  assert.match(invalid.data.message, /claude-haiku-5-5, claude-sonnet-5-5/);
  assert.equal((await call('GET', `/documents/${documentId}/extraction`)).data.status, 'FAILED');

  env.setAiMode('ok');
  const requestsBefore = env.aiRequests.length;
  const queued = await call('POST', `/documents/${documentId}/extraction`, { model: 'claude-sonnet-5-5' });
  assert.equal(queued.status, 201);
  const extraction = await waitForAnalysis(documentId);
  assert.equal(extraction.status, 'COMPLETED');
  assert.equal(extraction.run.requestedModel, 'claude-sonnet-5-5');
  assert.equal(extraction.run.model, 'claude-sonnet-5-5');
  assert.deepEqual(env.aiRequests.slice(requestsBefore).map((r) => r.model), ['claude-sonnet-5-5']);

  // El modelo por defecto no cambia: el CV siguiente se analiza con Haiku.
  const next = await waitForAnalysis(await uploadCv());
  assert.equal(next.run.model, 'claude-haiku-5-5');
});

test('un perfil de cargo no se analiza todavía', async () => {
  const documentId = await uploadCv(CV_LINES, 'JOB_PROFILE');
  const { data } = await call('GET', `/documents/${documentId}/extraction`);
  assert.equal(data.status, 'PENDING_ANALYSIS');
  assert.equal((await call('POST', `/documents/${documentId}/extraction`)).status, 400);
});

test('un análisis interrumpido vuelve a la cola; si ya agotó sus intentos queda en error', async () => {
  // Se parte de análisis que fallaron (sin propuestas), como uno que se cortó a mitad: las propuestas se guardan
  // en la misma transacción que marca el análisis como terminado, así que uno interrumpido nunca las tiene.
  env.setAiMode('refusal');
  const retried = await uploadCv();
  const exhausted = await uploadCv();
  await waitForAnalysis(retried);
  await waitForAnalysis(exhausted);
  env.setAiMode('ok');
  // Se simula una API que se cayó a mitad del análisis hace 20 minutos.
  const runs = await prisma.extractionRun.findMany({
    where: { documentVersion: { documentId: { in: [retried, exhausted] } } },
    select: { id: true, documentVersion: { select: { documentId: true } } },
  });
  for (const run of runs) {
    const attempts = run.documentVersion.documentId === retried ? 1 : 3;
    await prisma.$executeRaw`UPDATE extraction_runs SET status = 'RUNNING', started_at = now() - interval '20 minutes',
      finished_at = NULL, attempt_count = ${attempts}::int WHERE id = ${run.id}::uuid`;
  }
  const again = await waitForAnalysis(retried);
  assert.equal(again.status, 'COMPLETED');
  assert.equal(again.run.attemptCount, 2);
  const failed = await waitForAnalysis(exhausted);
  assert.equal(failed.run.errorCode, 'INTERRUMPIDO');
});

// ---------- Revisión humana ----------

test('revisión: validaciones, persona nueva, competencia ya registrada y CV vinculado a otra persona', async () => {
  const a = await waitForAnalysis(await uploadCv());
  const sapA = proposalId(a, 'SAP PM');
  const mantA = proposalId(a, 'Mantención de compresores');

  // Confirmar sin persona y propuestas de otro CV.
  assert.equal((await call('POST', `/documents/${a.documentId}/extraction/review`, { decisions: [{ proposalId: sapA, action: 'confirm' }] })).status, 400);
  const other = await waitForAnalysis(await uploadCv());
  const foreign = await call('POST', `/documents/${a.documentId}/extraction/review`, {
    decisions: [{ proposalId: proposalId(other, 'SAP PM'), action: 'dismiss' }],
  });
  assert.equal(foreign.status, 400);

  // Persona nueva: SAP PM con nivel 3 y descartar la otra.
  const saved = await call('POST', `/documents/${a.documentId}/extraction/review`, {
    newEmployeeName: 'Juan Contreras Rojas',
    decisions: [
      { proposalId: sapA, action: 'confirm', level: 3 },
      { proposalId: mantA, action: 'dismiss' },
    ],
  });
  assert.equal(saved.status, 200, JSON.stringify(saved.data));
  assert.equal(saved.data.employee.created, true);
  assert.deepEqual(saved.data.registered, ['SAP PM']);
  assert.equal(saved.data.dismissed, 1);

  // Repetir la misma revisión.
  const repeated = await call('POST', `/documents/${a.documentId}/extraction/review`, { decisions: [{ proposalId: sapA, action: 'dismiss' }] });
  assert.equal(repeated.status, 409);

  // Otro CV de Juan: ahora se sugiere y SAP PM ya estaba registrada (no se modifica).
  assert.equal(other.suggestedEmployeeId, null, 'antes de crear a Juan no había sugerencia');
  const juan = await employeeId('Juan Contreras Rojas');
  const again = await call('GET', `/documents/${other.documentId}/extraction`);
  assert.equal(again.data.suggestedEmployeeId, juan);
  const both = await call('POST', `/documents/${other.documentId}/extraction/review`, {
    employeeId: juan,
    decisions: (other.proposals as Json[]).map((p) => ({ proposalId: p.id, action: 'confirm' })),
  });
  assert.deepEqual(both.data.alreadyRegistered, ['SAP PM']);
  assert.deepEqual(both.data.registered, ['Mantención de compresores']);

  // Un CV vinculado a Ana no se puede asignar después a Luis.
  const d = await waitForAnalysis(await uploadCv());
  const ana = await employeeId('Ana Rojas');
  const luis = await employeeId('Luis Vega');
  assert.equal((await call('POST', `/documents/${d.documentId}/extraction/review`, { employeeId: ana, decisions: [{ proposalId: proposalId(d, 'SAP PM'), action: 'confirm' }] })).status, 200);
  const conflict = await call('POST', `/documents/${d.documentId}/extraction/review`, {
    employeeId: luis,
    decisions: [{ proposalId: proposalId(d, 'Mantención de compresores'), action: 'confirm' }],
  });
  assert.equal(conflict.status, 409);
  assert.match(conflict.data.message, /Ana Rojas/);

  // Cada competencia registrada tiene su evidencia completa.
  const skills = await prisma.employeeSkill.findMany({ include: { evidence: true } });
  assert.ok(skills.length >= 3);
  for (const skill of skills) {
    assert.equal(skill.verificationStatus, 'DECLARED');
    assert.equal(skill.evidence?.kind, 'DOCUMENT');
    assert.ok(skill.evidence?.extractionRunId && skill.evidence.documentVersionId && skill.evidence.recordedByMemberId);
  }
});

// ---------- Directorio de Talento ----------

test('directorio: sin requisitos no hay ajuste; con requisitos se calcula con la regla', async () => {
  // Luis: Mantención (nivel 4) y SAP PM sin nivel. Marta: Mantención nivel 2.
  const luis = await employeeId('Luis Vega');
  const marta = await employeeId('Marta Díaz');
  for (const [person, decisions] of [
    [luis, (p: Json) => ({ proposalId: p.id, action: 'confirm' })],
    [marta, (p: Json) => (p.name === 'SAP PM' ? { proposalId: p.id, action: 'dismiss' } : { proposalId: p.id, action: 'confirm', level: 2 })],
  ] as const) {
    const cv = await waitForAnalysis(await uploadCv());
    const saved = await call('POST', `/documents/${cv.documentId}/extraction/review`, {
      employeeId: person,
      decisions: (cv.proposals as Json[]).map(decisions),
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.data));
  }

  const before = (await call('GET', '/talent')).data as unknown as Json[];
  assert.ok(before.every((person) => person.status === 'sin-requisitos'));

  const positions = (await call('GET', '/positions')).data as unknown as Json[];
  const tecnico = positions.find((p) => p.title === 'Técnico senior')!.id;
  const skills = (await call('GET', '/skills')).data as unknown as Json[];
  const mant = skills.find((s) => s.name === 'Mantención de compresores')!.id;
  const sap = skills.find((s) => s.name === 'SAP PM')!.id;
  const put = await call('PUT', `/positions/${tecnico}/skills`, {
    requirements: [
      { skillId: mant, requiredLevel: 3, weight: 2 },
      { skillId: sap, requiredLevel: 4 },
      { name: 'Hidráulica', category: 'TECHNICAL', requiredLevel: 3, isMandatory: false },
    ],
  });
  assert.equal(put.status, 200, JSON.stringify(put.data));

  const talent = (await call('GET', '/talent')).data as unknown as Json[];
  const luisFit = talent.find((t) => t.fullName === 'Luis Vega')!;
  const martaFit = talent.find((t) => t.fullName === 'Marta Díaz')!;
  // Luis: (2·1 + 1·0,5 + 1·0) / 4 = 63 %. Marta: (2·2/3) / 4 = 33 % y le falta SAP PM (obligatoria).
  assert.equal(luisFit.fitPercent, 63);
  assert.equal(luisFit.status, 'optimo');
  assert.equal(martaFit.fitPercent, 33);
  assert.equal(martaFit.status, 'critico');
  assert.match(martaFit.reasons[0], /Falta la competencia obligatoria "SAP PM"/);

  // "hidraulica" (sin tilde) reutiliza la competencia existente: aparece repetida y se rechaza.
  const dup = await call('PUT', `/positions/${tecnico}/skills`, {
    requirements: [{ name: 'Hidráulica', category: 'TECHNICAL' }, { name: 'hidraulica', category: 'TECHNICAL' }],
  });
  assert.equal(dup.status, 400);
  assert.equal((await call('PUT', `/positions/00000000-0000-4000-8000-000000000099/skills`, { requirements: [] })).status, 404);

  // Quitar los requisitos vuelve a "sin requisitos".
  assert.equal((await call('PUT', `/positions/${tecnico}/skills`, { requirements: [] })).status, 200);
  const cleared = (await call('GET', '/talent')).data as unknown as Json[];
  assert.equal(cleared.find((t) => t.fullName === 'Luis Vega')!.status, 'sin-requisitos');
});

// ---------- Restricciones de la base ----------

test('la base rechaza propuestas inválidas (CHECK de skill_proposals)', async () => {
  const run = await prisma.extractionRun.findFirstOrThrow({ where: { status: 'SUCCEEDED' } });
  const base = { organizationId: run.organizationId, extractionRunId: run.id, category: 'TECHNICAL' as const, excerpt: 'x' };
  await assert.rejects(prisma.skillProposal.create({ data: { ...base, name: 'Nivel 7', level: 7 } }));
  await assert.rejects(prisma.skillProposal.create({ data: { ...base, name: '  ' } }));
  await assert.rejects(prisma.skillProposal.create({ data: { ...base, name: 'Sin revisor', reviewStatus: 'DISMISSED' } }));
});
