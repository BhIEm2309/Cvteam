// Constantes de interfaz de la pantalla Directorio de Talento (no son datos).
import type { FitStatus } from './types'

export const FIT_STATUS_LABELS: Record<FitStatus, string> = {
  optimo: 'Óptimo',
  critico: 'Desajuste crítico',
  desaprovechado: 'Talento desaprovechado',
}

// Colores de cada estado: texto/borde de la etiqueta y color de la barra de ajuste.
export const FIT_STATUS_COLORS: Record<FitStatus, { badge: string; bar: string; text: string }> = {
  optimo: { badge: 'border-emerald-400/40 text-emerald-400', bar: 'bg-emerald-400', text: 'text-emerald-400' },
  critico: { badge: 'border-red-400/40 text-red-400', bar: 'bg-red-400', text: 'text-red-400' },
  desaprovechado: { badge: 'border-amber-400/40 text-amber-300', bar: 'bg-amber-400', text: 'text-amber-300' },
}
