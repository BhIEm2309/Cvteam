// Entorno de las pruebas de integración: PostgreSQL 17 en memoria (PGlite), API de Anthropic simulada y la API
// compilada (dist/main.js) corriendo como proceso aparte. No necesita Docker ni clave de IA.
//
// Por qué la API corre como proceso aparte: Nest necesita la metadata de decoradores que genera `nest build`
// (tsc); tsx no la genera.
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

const API_ROOT = join(__dirname, '..', '..');

// Asíncrono a propósito: PGlite corre en este mismo proceso; una ejecución síncrona lo bloquearía y Prisma
// no podría conectarse.
const run = promisify(execFile);

// Modo de la API de Anthropic simulada.
export type FakeAiMode = 'ok' | 'refusal' | 'unauthorized' | 'error500' | { respondAs: string };

export interface TestEnvironment {
  apiUrl: string;
  databaseUrl: string;
  setAiMode(mode: FakeAiMode): void;
  // Cuerpos de las solicitudes que recibió la API de Anthropic simulada.
  aiRequests: Record<string, unknown>[];
  stop(): Promise<void>;
}

// Competencias que devuelve la IA simulada. "Liderazgo" cita un fragmento que no está en el CV (debe descartarse).
const AI_OUTPUT = {
  candidateName: 'Juan Contreras Rojas',
  skills: [
    { name: 'Mantención de compresores', category: 'TECHNICAL', level: 4, excerpt: 'Experiencia en mantencion de compresores industriales' },
    { name: 'SAP PM', category: 'TECHNICAL', level: null, excerpt: 'Manejo de SAP PM' },
    { name: 'Liderazgo', category: 'BEHAVIORAL', level: null, excerpt: 'Dirigio un equipo de 40 personas' },
  ],
};

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

function startFakeAnthropic(state: { mode: FakeAiMode; requests: Record<string, unknown>[] }): Promise<Server> {
  const server = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => (body += chunk));
    request.on('end', () => {
      const parsed = JSON.parse(body || '{}') as Record<string, unknown>;
      state.requests.push(parsed);
      const reply = (status: number, payload: unknown) => {
        response.writeHead(status, { 'content-type': 'application/json' });
        response.end(JSON.stringify(payload));
      };
      if (state.mode === 'unauthorized') {
        return reply(401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } });
      }
      if (state.mode === 'error500') {
        return reply(500, { type: 'error', error: { type: 'api_error', message: 'falla simulada' } });
      }
      const refusal = state.mode === 'refusal';
      const model = typeof state.mode === 'object' ? state.mode.respondAs : parsed.model;
      return reply(200, {
        id: 'msg_prueba',
        type: 'message',
        role: 'assistant',
        model,
        content: [{ type: 'text', text: refusal ? '' : JSON.stringify(AI_OUTPUT) }],
        stop_reason: refusal ? 'refusal' : 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 100, output_tokens: 50 },
      });
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function waitForHealth(url: string, api: ChildProcess, log: () => string): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (api.exitCode !== null) {
      throw new Error(`La API terminó al arrancar (código ${api.exitCode}).\n${log()}`);
    }
    try {
      const response = await fetch(`${url}/health`);
      if (response.ok) return;
    } catch {
      // Todavía no escucha.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`La API no respondió /api/health en 30 s.\n${log()}`);
}

export async function startEnvironment(): Promise<TestEnvironment> {
  // Lo que se va abriendo se registra aquí para cerrarlo al final, o si algo falla al arrancar
  // (si no se cierra, el proceso de pruebas queda colgado).
  const cleanups: (() => Promise<void> | void)[] = [];
  const cleanup = async () => {
    while (cleanups.length > 0) await cleanups.pop()!();
  };

  try {
    // 1. PostgreSQL 17 en memoria con la extensión btree_gist (la usa la migración inicial).
    const db = await PGlite.create({ extensions: { btree_gist } });
    cleanups.push(() => db.close());
    const dbPort = await freePort();
    const dbServer = new PGLiteSocketServer({ db, port: dbPort, host: '127.0.0.1', maxConnections: 20 });
    await dbServer.start();
    cleanups.push(() => dbServer.stop());
    // pgbouncer=true: Prisma no reutiliza "prepared statements" (PGlite comparte una sola sesión entre conexiones).
    const databaseUrl = `postgresql://postgres:postgres@127.0.0.1:${dbPort}/postgres?sslmode=disable&connection_limit=1&pgbouncer=true`;

    // 2. Migraciones y datos de demostración, igual que en Docker.
    const baseEnv = { ...process.env, DATABASE_URL: databaseUrl };
    await run(process.execPath, [join(API_ROOT, 'node_modules', 'prisma', 'build', 'index.js'), 'migrate', 'deploy'], { cwd: API_ROOT, env: baseEnv });
    await run(process.execPath, [join(API_ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs'), 'prisma/seed.ts'], { cwd: API_ROOT, env: baseEnv });

    // 3. API de Anthropic simulada.
    const aiState = { mode: 'ok' as FakeAiMode, requests: [] as Record<string, unknown>[] };
    const fakeAi = await startFakeAnthropic(aiState);
    cleanups.push(() => new Promise<void>((resolve) => fakeAi.close(() => resolve())));
    const aiPort = (fakeAi.address() as AddressInfo).port;

    // 4. La API compilada, con almacenamiento temporal. Las variables explícitas ganan a las de api/.env.
    const storageDir = mkdtempSync(join(tmpdir(), 'cvteam-pruebas-'));
    cleanups.push(() => rmSync(storageDir, { recursive: true, force: true }));
    const apiPort = await freePort();
    let output = '';
    const api = spawn(process.execPath, ['dist/main.js'], {
      cwd: API_ROOT,
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        PORT: String(apiPort),
        STORAGE_DIR: storageDir,
        DEMO_ORGANIZATION_SLUG: 'demo',
        ANTHROPIC_API_KEY: 'clave-falsa-de-prueba',
        ANTHROPIC_BASE_URL: `http://127.0.0.1:${aiPort}`,
        EXTRACTION_MODEL: 'claude-haiku-5-5',
        EXTRACTION_WORKER: 'on',
        EXTRACTION_POLL_MS: '200',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    cleanups.push(async () => {
      if (api.exitCode === null) {
        const exited = new Promise((resolve) => api.once('exit', resolve));
        api.kill();
        await exited;
      }
    });
    api.stdout?.on('data', (chunk) => (output += chunk));
    api.stderr?.on('data', (chunk) => (output += chunk));
    const apiUrl = `http://127.0.0.1:${apiPort}/api`;
    await waitForHealth(apiUrl, api, () => output.slice(-4000));

    return {
      apiUrl,
      databaseUrl,
      aiRequests: aiState.requests,
      setAiMode(mode) {
        aiState.mode = mode;
      },
      stop: cleanup,
    };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
