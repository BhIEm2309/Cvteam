// Constantes de interfaz de la pantalla Ingesta (no son datos).
import type { AnalysisStatus, DocumentType } from './types'

// Nombres en español para mostrar en la interfaz.
export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  CV: 'CV',
  JOB_PROFILE: 'Perfil de cargo',
  SUPPORTING: 'Documento de apoyo',
}

// Estado del análisis con IA: texto y colores de la etiqueta.
export const ANALYSIS_STATUS_LABELS: Record<AnalysisStatus, { label: string; className: string }> = {
  PENDING_ANALYSIS: { label: 'Sin analizar', className: 'border-border text-muted-foreground' },
  QUEUED: { label: 'En cola', className: 'border-sky-400/40 text-sky-300' },
  PROCESSING: { label: 'Analizando', className: 'border-sky-400/40 text-sky-300' },
  COMPLETED: { label: 'Analizado', className: 'border-emerald-400/40 text-emerald-300' },
  FAILED: { label: 'Error', className: 'border-red-400/40 text-red-300' },
}

// Mientras haya CVs en cola o analizándose, la lista se vuelve a pedir cada este tiempo (milisegundos).
export const ANALYSIS_POLL_INTERVAL_MS = 3000
