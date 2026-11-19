import { existsSync } from 'node:fs';
import path from 'node:path';

// Carga api/.env si existe (por ejemplo ANTHROPIC_API_KEY). Las variables ya definidas en el entorno
// (como las de docker-compose.yml) no se reemplazan: Node solo agrega las que faltan.
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

// Configuración de la API leída desde variables de entorno.
// Si una variable no existe, se usa el valor por defecto indicado.

function readPositiveNumber(name: string, defaultValue: number): number {
  const rawValue = process.env[name];

  if (rawValue === undefined || rawValue === '') {
    return defaultValue;
  }

  const value = Number(rawValue);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`La variable de entorno ${name} debe ser un número positivo (valor actual: "${rawValue}").`);
  }

  return value;
}

const maxUploadMb = readPositiveNumber('MAX_UPLOAD_MB', 10);

// Proveedores de IA para analizar CVs. Gemini (plan gratis de Google) es el de por defecto mientras el prototipo
// no tenga presupuesto; Claude (Anthropic) queda configurable para cuando lo haya.
export const EXTRACTION_PROVIDERS = ['gemini', 'claude'] as const;
export type ExtractionProviderId = (typeof EXTRACTION_PROVIDERS)[number];

function readExtractionProvider(): ExtractionProviderId {
  const rawValue = (process.env.EXTRACTION_PROVIDER ?? '').trim().toLowerCase();
  if (rawValue === '') {
    return 'gemini';
  }
  if (!(EXTRACTION_PROVIDERS as readonly string[]).includes(rawValue)) {
    throw new Error(`EXTRACTION_PROVIDER debe ser "gemini" o "claude" (valor actual: "${rawValue}").`);
  }
  return rawValue as ExtractionProviderId;
}

// Lista de esperas en milisegundos separadas por coma ("5000,15000,45000"). Vacía = sin reintentos ("none").
function readDelayList(name: string, defaultValue: number[]): number[] {
  const rawValue = (process.env[name] ?? '').trim();
  if (rawValue === '') {
    return defaultValue;
  }
  if (rawValue === 'none') {
    return [];
  }
  const values = rawValue.split(',').map((part) => Number(part.trim()));
  if (values.some((value) => !Number.isInteger(value) || value < 0)) {
    throw new Error(`La variable de entorno ${name} debe ser una lista de milisegundos separados por coma (valor actual: "${rawValue}").`);
  }
  return values;
}

const extractionProvider = readExtractionProvider();

// Las claves (GEMINI_API_KEY, ANTHROPIC_API_KEY) se leen del entorno al usarlas; aquí solo se registra si
// existen, nunca su valor.
const gemini = {
  apiKeyConfigured: (process.env.GEMINI_API_KEY ?? '').trim() !== '',
  // Flash-Lite: el más rápido y el que menos falló por alta demanda en la prueba del 19-11-2026.
  model: process.env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash-lite',
  // Solo para pruebas (servidor falso). Por defecto, la API oficial de Google.
  baseUrl: (process.env.GEMINI_BASE_URL?.trim() || 'https://generativelanguage.googleapis.com').replace(/\/+$/, ''),
  // Esperas antes de cada reintento cuando Gemini está saturado (503) o se pasa el límite por minuto (429).
  // En el plan gratis la mitad de las llamadas de la prueba recibió 503.
  retryDelaysMs: readDelayList('GEMINI_RETRY_DELAYS_MS', [5000, 15000, 45000]),
  // Tiempo máximo de cada llamada.
  timeoutMs: readPositiveNumber('GEMINI_TIMEOUT_MS', 2 * 60 * 1000),
};

const claude = {
  apiKeyConfigured: (process.env.ANTHROPIC_API_KEY ?? '').trim() !== '',
  // Por defecto Claude Haiku 5.5 (el más económico). EXTRACTION_MODEL es el nombre anterior de esta variable:
  // se sigue leyendo para no romper un api/.env antiguo (la API avisa al iniciar).
  model: process.env.CLAUDE_MODEL?.trim() || process.env.EXTRACTION_MODEL?.trim() || 'claude-haiku-5-5',
  // Modelo que se puede elegir para analizar de nuevo un CV puntual (por ejemplo, si Haiku lo rechazó:
  // Haiku 5.5 no tiene respaldo automático en el servidor). Es fijo: el navegador no puede pedir otro.
  alternativeModel: 'claude-sonnet-5-5',
};

export const config = {
  // Puerto donde escucha la API.
  port: readPositiveNumber('PORT', 3000),

  // Carpeta donde se guardan los archivos subidos.
  storageDir: path.resolve(process.env.STORAGE_DIR ?? './storage'),

  // Organización con la que trabaja la API mientras no exista login.
  demoOrganizationSlug: process.env.DEMO_ORGANIZATION_SLUG ?? 'demo',

  // Tamaño máximo de un archivo subido.
  maxUploadMb: maxUploadMb,
  maxUploadBytes: maxUploadMb * 1024 * 1024,

  // Extracción de competencias con IA (Paso 5). EXTRACTION_PROVIDER elige el proveedor: gemini (por defecto) o claude.
  extraction: {
    provider: extractionProvider,
    gemini,
    claude,
    // Datos del proveedor activo (los usan el proceso en segundo plano y la pantalla de Ingesta).
    apiKeyConfigured: extractionProvider === 'gemini' ? gemini.apiKeyConfigured : claude.apiKeyConfigured,
    apiKeyVariable: extractionProvider === 'gemini' ? 'GEMINI_API_KEY' : 'ANTHROPIC_API_KEY',
    model: extractionProvider === 'gemini' ? gemini.model : claude.model,
    // Solo Claude tiene un modelo alternativo para analizar de nuevo un CV puntual.
    alternativeModel: extractionProvider === 'claude' ? claude.alternativeModel : null,
    // true si api/.env todavía usa el nombre antiguo EXTRACTION_MODEL (ahora CLAUDE_MODEL).
    legacyModelVariable: (process.env.EXTRACTION_MODEL ?? '').trim() !== '' && (process.env.CLAUDE_MODEL ?? '').trim() === '',
    // "off" apaga el proceso que analiza los CVs en segundo plano (los análisis quedan en cola).
    workerEnabled: process.env.EXTRACTION_WORKER !== 'off',
    // Cada cuántos milisegundos se revisa si hay CVs en cola.
    pollIntervalMs: readPositiveNumber('EXTRACTION_POLL_MS', 5000),
  },
};
