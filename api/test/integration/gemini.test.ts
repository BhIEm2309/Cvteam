// Pruebas de integración con EXTRACTION_PROVIDER=gemini: la API completa contra PostgreSQL en memoria (PGlite) y una
// API de Gemini simulada (nunca la real). Ejecutar con: pnpm test:integration (en la carpeta api).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { makePdf } from '../helpers/pdf';
import { startEnvironment, type TestEnvironment } from './environment';

let env: TestEnvironment;

const CV_LINES = ['Juan Contreras Rojas', 'Experiencia en mantencion de compresores industriales', 'Manejo de SAP PM para ordenes de trabajo'];

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

test('con Gemini un CV se analiza con el mismo filtro de citas y queda registrado el modelo', async () => {
  env.setAiMode('ok');
  const extraction = await waitForAnalysis(await uploadCv());

  assert.equal(extraction.status, 'COMPLETED', JSON.stringify(extraction));
  assert.equal(extraction.run.model, 'gemini-3.5-flash-lite');
  // "Liderazgo" cita un fragmento que no está en el CV: se descarta igual que con Claude.
  assert.deepEqual((extraction.proposals as Json[]).map((p) => p.name).sort(), ['Mantención de compresores', 'SAP PM']);
  const request = env.aiRequests.at(-1)!;
  assert.equal(request.model, 'gemini-3.5-flash-lite');
  assert.equal(request.store, false);
});

test('si Gemini está saturado una vez, el reintento automático termina el análisis', async () => {
  env.setAiMode('busyOnce');
  const before = env.aiRequests.length;
  const extraction = await waitForAnalysis(await uploadCv());

  assert.equal(extraction.status, 'COMPLETED', JSON.stringify(extraction));
  assert.equal(env.aiRequests.length - before, 2);
});

test('si Gemini sigue saturado, el CV queda en IA_NO_DISPONIBLE y se puede analizar de nuevo', async () => {
  env.setAiMode('error500');
  const documentId = await uploadCv();
  const failed = await waitForAnalysis(documentId);
  assert.equal(failed.status, 'FAILED');
  assert.equal(failed.run.errorCode, 'IA_NO_DISPONIBLE');

  env.setAiMode('ok');
  assert.equal((await call('POST', `/documents/${documentId}/extraction`)).status, 201);
  assert.equal((await waitForAnalysis(documentId)).status, 'COMPLETED');
});

test('con Gemini no se puede pedir el modelo alternativo de Claude', async () => {
  env.setAiMode('unauthorized');
  const documentId = await uploadCv();
  assert.equal((await waitForAnalysis(documentId)).run.errorCode, 'IA_CLAVE_INVALIDA');

  const response = await call('POST', `/documents/${documentId}/extraction`, { model: 'claude-sonnet-5-5' });
  assert.equal(response.status, 400);
  assert.match(response.data.message, /gemini-3\.5-flash-lite/);
  env.setAiMode('ok');
});
