import { DATA_MODE } from './data-mode'
import { ApiNoDisponibleError, RutaNoExisteError } from './http'

// Por qué una pantalla muestra datos de ejemplo.
export type MockReason = 'modo-mock' | 'api-no-disponible' | 'ruta-no-existe'

// Datos cargados junto con su fuente real, para mostrar el aviso y el indicador de la barra superior.
export type Loaded<T> = { data: T; source: 'api' } | { data: T; source: 'mock'; reason: MockReason }

export type DataSource = Loaded<unknown>['source']

interface LoadDataOptions<T> {
  fromApi: () => Promise<T>
  fromMock: () => T | Promise<T>
}

// Aplica las reglas del modo de datos (ver data-mode.ts y CLAUDE.md):
// solo se usan datos de ejemplo si el modo es "mock", o si en "auto" la API no responde o la ruta no existe.
// Cualquier otro error de la API se lanza tal cual: nunca se esconde un bug detrás de datos de ejemplo.
export async function loadData<T>({ fromApi, fromMock }: LoadDataOptions<T>): Promise<Loaded<T>> {
  if (DATA_MODE === 'mock') {
    return { data: await fromMock(), source: 'mock', reason: 'modo-mock' }
  }

  try {
    return { data: await fromApi(), source: 'api' }
  } catch (error) {
    const reason = DATA_MODE === 'auto' ? getFallbackReason(error) : null
    if (reason === null) {
      throw error
    }
    return { data: await fromMock(), source: 'mock', reason }
  }
}

// Devuelve el motivo para usar datos de ejemplo, o null si el error debe mostrarse.
export function getFallbackReason(error: unknown): MockReason | null {
  if (error instanceof ApiNoDisponibleError) {
    return 'api-no-disponible'
  }
  if (error instanceof RutaNoExisteError) {
    return 'ruta-no-existe'
  }
  return null
}
