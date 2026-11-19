// Pruebas del proveedor de Gemini contra un servidor local que imita la API "interactions" de Google
// (no llama a la IA real). Ejecutar con: pnpm test (en la carpeta api).
import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { GeminiExtractionProvider as ProviderClass } from '../src/modules/extraction/gemini-extraction.provider';
import { ExtractionFailure } from '../src/modules/extraction/extraction-provider';

const CV = 'Juan Contreras Rojas\nManejo de SAP PM';
const OUTPUT = { candidateName: 'Juan Contreras Rojas', skills: [{ name: 'SAP PM', category: 'TECHNICAL', level: null, excerpt: 'Manejo de SAP PM' }] };

// Respuestas que el servidor falso entrega en orden (la última se repite).
type FakeReply = { status: number; body: unknown };
let replies: FakeReply[] = [];
let requests: { headers: Record<string, string | string[] | undefined>; body: Record<string, unknown>; url: string }[] = [];
let server: Server;
let Provider: typeof ProviderClass;

function ok(output: unknown = OUTPUT, extra: Record<string, unknown> = {}): FakeReply {
  return {
    status: 200,
    body: {
      id: 'interaccion-prueba',
      status: 'completed',
      model: 'gemini-3.5-flash-lite',
      steps: [{ type: 'model_output', content: [{ type: 'text', text: JSON.stringify(output) }] }],
      ...extra,
    },
  };
}
function fail(status: number, code: string): FakeReply {
  return { status, body: { error: { code, message: `Error de prueba ${code}` } } };
}

before(async () => {
  server = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => (body += chunk));
    request.on('end', () => {
      requests.push({ headers: request.headers, body: JSON.parse(body) as Record<string, unknown>, url: request.url ?? '' });
      const reply = replies.length > 1 ? replies.shift()! : replies[0];
      response.writeHead(reply.status, { 'content-type': 'application/json' });
      response.end(JSON.stringify(reply.body));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  // Se configuran antes de cargar config.ts (lee el entorno al importarse). Sin esperas entre reintentos.
  process.env.GEMINI_API_KEY = 'clave-de-prueba';
  process.env.GEMINI_BASE_URL = `http://127.0.0.1:${port}`;
  process.env.GEMINI_MODEL = '';
  process.env.GEMINI_RETRY_DELAYS_MS = '0,0,0';
  ({ GeminiExtractionProvider: Provider } = await import('../src/modules/extraction/gemini-extraction.provider'));
});

beforeEach(() => {
  requests = [];
  process.env.GEMINI_API_KEY = 'clave-de-prueba';
});

after(() => {
  server.close();
});

async function expectFailure(code: string, messagePart?: string): Promise<void> {
  await assert.rejects(new Provider().extractCvSkills(CV), (error: unknown) => {
    assert.ok(error instanceof ExtractionFailure);
    assert.equal(error.code, code);
    if (messagePart) assert.match(error.message, new RegExp(messagePart));
    return true;
  });
}

test('pide el modelo por defecto con el esquema JSON y devuelve las competencias', async () => {
  replies = [ok()];
  const result = await new Provider().extractCvSkills(CV);

  assert.deepEqual(result.extraction, OUTPUT);
  assert.equal(result.respondedModel, 'gemini-3.5-flash-lite');
  const [request] = requests;
  assert.equal(request.url, '/v1beta/interactions');
  assert.equal(request.headers['x-goog-api-key'], 'clave-de-prueba');
  assert.equal(request.body.model, 'gemini-3.5-flash-lite');
  assert.equal(request.body.store, false);
  assert.match(String(request.body.input), /<cv>\nJuan Contreras Rojas/);
  const format = request.body.response_format as { mime_type: string; schema: Record<string, unknown> };
  assert.equal(format.mime_type, 'application/json');
  assert.equal(format.schema.type, 'object');
  assert.equal('$schema' in format.schema, false);
});

test('si Gemini está saturado (503), reintenta y termina bien', async () => {
  replies = [fail(503, 'service_unavailable'), fail(503, 'service_unavailable'), ok()];
  const result = await new Provider().extractCvSkills(CV);
  assert.equal(result.extraction.skills.length, 1);
  assert.equal(requests.length, 3);
});

test('si sigue saturado después de los reintentos, queda IA_NO_DISPONIBLE', async () => {
  replies = [fail(503, 'service_unavailable')];
  await expectFailure('IA_NO_DISPONIBLE', 'alta demanda');
  assert.equal(requests.length, 4); // 1 intento + 3 reintentos
});

test('límite diario (quota_exceeded): no reintenta y lo explica', async () => {
  replies = [fail(429, 'quota_exceeded')];
  await expectFailure('IA_NO_DISPONIBLE', 'límite diario');
  assert.equal(requests.length, 1);
});

test('límite por minuto: reintenta y, si persiste, lo explica', async () => {
  replies = [fail(429, 'rate_limit_exceeded')];
  await expectFailure('IA_NO_DISPONIBLE', 'límite por minuto');
  assert.equal(requests.length, 4);
});

test('clave inválida (401) o bloqueada (403): IA_CLAVE_INVALIDA sin reintentar', async () => {
  replies = [fail(401, 'authentication')];
  await expectFailure('IA_CLAVE_INVALIDA');
  replies = [fail(403, 'permission_denied')];
  await expectFailure('IA_CLAVE_INVALIDA', 'bloqueada');
  assert.equal(requests.length, 2);
});

test('modelo inexistente (404): indica revisar GEMINI_MODEL', async () => {
  replies = [fail(404, 'model_not_found')];
  await expectFailure('ERROR_INTERNO', 'GEMINI_MODEL');
});

test('respuesta fuera del esquema o incompleta: IA_RESPUESTA_INVALIDA', async () => {
  replies = [ok({ candidateName: 'Juan', skills: [{ name: 'SAP PM' }] })];
  await expectFailure('IA_RESPUESTA_INVALIDA', 'formato esperado');
  replies = [ok(OUTPUT, { status: 'incomplete' })];
  await expectFailure('IA_RESPUESTA_INVALIDA', 'incompleta');
});

test('sin GEMINI_API_KEY falla con IA_NO_CONFIGURADA sin llamar a Gemini', async () => {
  delete process.env.GEMINI_API_KEY;
  await expectFailure('IA_NO_CONFIGURADA', 'GEMINI_API_KEY');
  assert.equal(requests.length, 0);
});

test('el mensaje de error nunca incluye la clave', async () => {
  replies = [fail(401, 'authentication')];
  await assert.rejects(new Provider().extractCvSkills(CV), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.equal(error.message.includes('clave-de-prueba'), false);
    return true;
  });
});
