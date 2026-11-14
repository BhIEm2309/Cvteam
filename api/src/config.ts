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

  // Extracción de competencias con IA (Paso 5). La clave ANTHROPIC_API_KEY la lee el SDK de Anthropic
  // directamente desde el entorno; aquí solo se registra si existe, nunca su valor.
  extraction: {
    apiKeyConfigured: (process.env.ANTHROPIC_API_KEY ?? '').trim() !== '',
    // Por defecto Claude Haiku 5.5 (el más económico). Si la calidad de las competencias no alcanza,
    // la alternativa es claude-sonnet-5-5 (EXTRACTION_MODEL=claude-sonnet-5-5 en api/.env).
    model: process.env.EXTRACTION_MODEL?.trim() || 'claude-haiku-5-5',
    // Modelo que se puede elegir para analizar de nuevo un CV puntual (por ejemplo, si Haiku lo rechazó:
    // Haiku 5.5 no tiene respaldo automático en el servidor). Es fijo: el navegador no puede pedir otro.
    alternativeModel: 'claude-sonnet-5-5',
    // "off" apaga el proceso que analiza los CVs en segundo plano (los análisis quedan en cola).
    workerEnabled: process.env.EXTRACTION_WORKER !== 'off',
    // Cada cuántos milisegundos se revisa si hay CVs en cola.
    pollIntervalMs: readPositiveNumber('EXTRACTION_POLL_MS', 5000),
  },
};
