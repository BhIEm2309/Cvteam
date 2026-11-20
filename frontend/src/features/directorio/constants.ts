// Constantes de interfaz de la pantalla Directorio de Talento (no son datos).
import type { FitStatus, SkillCategory, TalentSkill } from './types'

export const FIT_STATUS_LABELS: Record<FitStatus, string> = {
  optimo: 'Óptimo',
  parcial: 'Ajuste parcial',
  critico: 'Desajuste crítico',
  desaprovechado: 'Talento desaprovechado',
  'sin-requisitos': 'Sin requisitos del cargo',
}

// Colores de cada estado: texto/borde de la etiqueta y color de la barra de ajuste.
export const FIT_STATUS_COLORS: Record<FitStatus, { badge: string; bar: string; text: string }> = {
  optimo: { badge: 'border-emerald-400/40 text-emerald-400', bar: 'bg-emerald-400', text: 'text-emerald-400' },
  parcial: { badge: 'border-sky-400/40 text-sky-300', bar: 'bg-sky-400', text: 'text-sky-300' },
  critico: { badge: 'border-red-400/40 text-red-400', bar: 'bg-red-400', text: 'text-red-400' },
  desaprovechado: { badge: 'border-amber-400/40 text-amber-300', bar: 'bg-amber-400', text: 'text-amber-300' },
  'sin-requisitos': { badge: 'border-border text-muted-foreground', bar: 'bg-muted-foreground/40', text: 'text-muted-foreground' },
}

export const SKILL_CATEGORY_LABELS: Record<SkillCategory, string> = {
  TECHNICAL: 'Técnica',
  BEHAVIORAL: 'Blanda',
}

export const VERIFICATION_LABELS: Record<TalentSkill['verificationStatus'], string> = {
  DECLARED: 'Declarada (CV)',
  VERIFIED: 'Verificada',
  REJECTED: 'Rechazada',
}

// Nivel máximo de la escala (1 a 5).
export const MAX_LEVEL = 5

// Cantidad de competencias que se muestran en la tabla.
export const KEY_SKILLS_IN_TABLE = 3
