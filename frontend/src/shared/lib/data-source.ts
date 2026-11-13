import { useEffect, useSyncExternalStore } from 'react'
import { ApiNoDisponibleError } from './http'
import type { Loaded } from './load-data'

// Estado de la fuente de datos de cada pantalla, para el indicador de la barra superior.
export type SourceStatus = 'cargando' | 'conectado' | 'ejemplo' | 'sin-conexion' | 'error'

// Almacén mínimo: ruta de la pantalla (por ejemplo "/ingesta") → estado.
const statuses = new Map<string, SourceStatus>()
const listeners = new Set<() => void>()

function setSourceStatus(pagePath: string, status: SourceStatus) {
  if (statuses.get(pagePath) === status) {
    return
  }
  statuses.set(pagePath, status)
  for (const listener of listeners) {
    listener()
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

// La barra superior lo usa para leer el estado de la pantalla actual.
export function useSourceStatus(pagePath: string): SourceStatus | undefined {
  return useSyncExternalStore(subscribe, () => statuses.get(pagePath))
}

// Cada pantalla informa el estado de su consulta principal.
export function useReportSourceStatus(pagePath: string, status: SourceStatus) {
  useEffect(() => {
    setSourceStatus(pagePath, status)
  }, [pagePath, status])
}

// Traduce el resultado de una consulta de TanStack Query al estado del indicador.
export function getSourceStatus(query: { isPending: boolean; error: Error | null; data?: Loaded<unknown> }): SourceStatus {
  if (query.error) {
    return query.error instanceof ApiNoDisponibleError ? 'sin-conexion' : 'error'
  }
  if (query.isPending || !query.data) {
    return 'cargando'
  }
  return query.data.source === 'api' ? 'conectado' : 'ejemplo'
}
