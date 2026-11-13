import path from 'node:path';

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
};
