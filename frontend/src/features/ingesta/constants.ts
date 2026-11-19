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

// El modelo alternativo para analizar de nuevo un CV puntual lo informa la API (GET /api/extraction/settings):
// solo existe con Claude. Con Gemini no se muestra el botón.

// Errores en que tiene sentido ofrecer el modelo alternativo. En IA_RECHAZO se destaca: Haiku 5.5 no tiene
// respaldo automático y Sonnet puede aceptar el CV. En los demás (PDF sin texto, clave inválida, servicio caído)
// otro modelo no ayuda, así que no se ofrece.
export const ALTERNATIVE_MODEL_ERRORS: Record<string, 'destacado' | 'secundario'> = {
  IA_RECHAZO: 'destacado',
  IA_RESPUESTA_INVALIDA: 'secundario',
}

// Mientras haya CVs en cola o analizándose, la lista se vuelve a pedir cada este tiempo (milisegundos).
export const ANALYSIS_POLL_INTERVAL_MS = 3000

// Categorías de competencias (skills.category).
export const SKILL_CATEGORY_LABELS: Record<'TECHNICAL' | 'BEHAVIORAL', string> = {
  TECHNICAL: 'Técnicas',
  BEHAVIORAL: 'Blandas',
}
