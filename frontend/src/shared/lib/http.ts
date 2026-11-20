import type { z } from 'zod'

// Cliente HTTP común para hablar con la API.
// Todas las rutas empiezan con /api: Vite las reenvía al servidor de la API (ver vite.config.ts).

// Encabezado que agrega el proxy de Vite cuando no logra conectarse con la API (ver vite.config.ts).
export const API_UNAVAILABLE_HEADER = 'X-Api-No-Disponible'

// La API no respondió: error de red, o el proxy de Vite no pudo conectarse con ella.
export class ApiNoDisponibleError extends Error {
  constructor() {
    super('No hay conexión con la API. Revisa que esté funcionando.')
    this.name = 'ApiNoDisponibleError'
  }
}

// La API respondió, pero esa ruta todavía no existe (404 de NestJS "Cannot GET ..." o 501).
export class RutaNoExisteError extends Error {
  constructor(path: string) {
    super(`La ruta ${path} todavía no existe en la API.`)
    this.name = 'RutaNoExisteError'
  }
}

// La API respondió con un error real (400, 404 de un recurso, 500...). Nunca se esconde con datos de ejemplo.
export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

// GET a la API. Valida la respuesta con el esquema Zod de la pantalla.
export async function apiGet<T>(path: string, schema: z.ZodType<T>, defaultMessage: string): Promise<T> {
  let response: Response
  try {
    response = await fetch(path)
  } catch {
    throw new ApiNoDisponibleError()
  }

  const responseText = await response.text()

  if (!response.ok) {
    throw classifyErrorResponse(path, response.status, response.headers.get(API_UNAVAILABLE_HEADER), responseText, defaultMessage)
  }

  return parseResponse(path, response.status, responseText, schema)
}

// POST de un formulario (por ejemplo, con un archivo). Valida la respuesta con el esquema Zod.
export async function apiPostForm<T>(path: string, formData: FormData, schema: z.ZodType<T>, defaultMessage: string): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, { method: 'POST', body: formData })
  } catch {
    throw new ApiNoDisponibleError()
  }

  const responseText = await response.text()

  if (!response.ok) {
    throw classifyErrorResponse(path, response.status, response.headers.get(API_UNAVAILABLE_HEADER), responseText, defaultMessage)
  }

  return parseResponse(path, response.status, responseText, schema)
}

// POST con un cuerpo JSON. Valida la respuesta con el esquema Zod.
export function apiPostJson<T>(path: string, body: unknown, schema: z.ZodType<T>, defaultMessage: string): Promise<T> {
  return sendJson('POST', path, body, schema, defaultMessage)
}

// PUT con un cuerpo JSON (reemplazar un recurso). Valida la respuesta con el esquema Zod.
export function apiPutJson<T>(path: string, body: unknown, schema: z.ZodType<T>, defaultMessage: string): Promise<T> {
  return sendJson('PUT', path, body, schema, defaultMessage)
}

// PATCH con un cuerpo JSON (cambiar parte de un recurso). Valida la respuesta con el esquema Zod.
export function apiPatchJson<T>(path: string, body: unknown, schema: z.ZodType<T>, defaultMessage: string): Promise<T> {
  return sendJson('PATCH', path, body, schema, defaultMessage)
}

async function sendJson<T>(
  method: 'POST' | 'PUT' | 'PATCH',
  path: string,
  body: unknown,
  schema: z.ZodType<T>,
  defaultMessage: string,
): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new ApiNoDisponibleError()
  }

  const responseText = await response.text()

  if (!response.ok) {
    throw classifyErrorResponse(path, response.status, response.headers.get(API_UNAVAILABLE_HEADER), responseText, defaultMessage)
  }

  return parseResponse(path, response.status, responseText, schema)
}

// Convierte el texto de una respuesta exitosa en datos validados.
export function parseResponse<T>(path: string, status: number, responseText: string, schema: z.ZodType<T>): T {
  let body: unknown
  try {
    body = JSON.parse(responseText)
  } catch {
    throw new ApiError(status, `La API respondió algo que no es JSON en ${path}.`)
  }

  const result = schema.safeParse(body)
  if (!result.success) {
    console.error(`Respuesta inesperada de ${path}:`, result.error.issues)
    throw new ApiError(status, `La API respondió con datos en un formato inesperado (${path}).`)
  }

  return result.data
}

// Decide qué tipo de error es una respuesta fallida. Lo usan fetch (apiGet) y XMLHttpRequest (subida de archivos).
export function classifyErrorResponse(
  path: string,
  status: number,
  unavailableHeader: string | null,
  responseText: string,
  defaultMessage: string,
): Error {
  if (status === 503 && unavailableHeader === '1') {
    return new ApiNoDisponibleError()
  }

  if (status === 501 || (status === 404 && isRouteMissing(responseText))) {
    return new RutaNoExisteError(path)
  }

  return new ApiError(status, getErrorMessage(responseText, defaultMessage))
}

// NestJS responde "Cannot GET /api/..." cuando la ruta no existe. Cualquier otro 404 es un "no encontrado" real.
function isRouteMissing(responseText: string): boolean {
  const message = readMessage(responseText)
  return typeof message === 'string' && /^Cannot (GET|POST|PUT|PATCH|DELETE) /.test(message)
}

// La API responde los errores como { "message": "..." }. Si no viene un mensaje, se usa el texto por defecto.
function getErrorMessage(responseText: string, defaultMessage: string): string {
  const message = readMessage(responseText)
  if (typeof message === 'string') {
    return message
  }
  if (Array.isArray(message)) {
    return message.join(' ')
  }
  return defaultMessage
}

function readMessage(responseText: string): unknown {
  try {
    const body: unknown = JSON.parse(responseText)
    if (typeof body === 'object' && body !== null && 'message' in body) {
      return body.message
    }
  } catch {
    // La respuesta no era JSON.
  }
  return undefined
}
