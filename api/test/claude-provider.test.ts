// Pruebas del proveedor de Claude contra un servidor local que imita la API de Anthropic (no llama a la IA real).
// El SDK se apunta al servidor local con ANTHROPIC_BASE_URL. Ejecutar con: pnpm test (en la carpeta api).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { ClaudeExtractionProvider as ProviderClass } from '../src/modules/extraction/claude-extraction.provider';

const CV = 'Juan Contreras Rojas\nManejo de SAP PM';
let server: Server;
// Cuerpo de la última solicitud recibida y modelo con el que responde el servidor falso.
let lastRequest: Record<string, unknown> = {};
let respondWithModel: string | null = null;
let Provider: typeof ProviderClass;

before(async () => {
  server = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => (body += chunk));
    request.on('end', () => {
      lastRequest = JSON.parse(body) as Record<string, unknown>;
      const output = { candidateName: 'Juan Contreras Rojas', skills: [{ name: 'SAP PM', category: 'TECHNICAL', level: null, excerpt: 'Manejo de SAP PM' }] };
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({
          id: 'msg_prueba',
          type: 'message',
          role: 'assistant',
          model: respondWithModel ?? lastRequest.model,
          content: [{ type: 'text', text: JSON.stringify(output) }],
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: { input_tokens: 10, output_tokens: 10 },
        }),
      );
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  // Se configuran antes de cargar config.ts (lee el entorno al importarse).
  process.env.ANTHROPIC_API_KEY = 'clave-de-prueba';
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${port}`;
  process.env.EXTRACTION_MODEL = '';
  ({ ClaudeExtractionProvider: Provider } = await import('../src/modules/extraction/claude-extraction.provider'));
});

after(() => {
  server.close();
});

test('pide el modelo por defecto (claude-haiku-5-5) y devuelve el que respondió', async () => {
  respondWithModel = null;
  const provider = new Provider();
  const result = await provider.extractCvSkills(CV);
  assert.equal(lastRequest.model, 'claude-haiku-5-5');
  assert.equal(provider.model, 'claude-haiku-5-5');
  assert.equal(result.respondedModel, 'claude-haiku-5-5');
  assert.equal(result.extraction.skills[0].name, 'SAP PM');
});

test('si responde otro modelo (respaldo), se informa el que respondió', async () => {
  respondWithModel = 'claude-sonnet-5';
  const result = await new Provider().extractCvSkills(CV);
  assert.equal(result.respondedModel, 'claude-sonnet-5');
});
