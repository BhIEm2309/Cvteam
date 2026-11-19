import { config } from '../../config';

// Nombres visibles de los modelos que pueden aparecer en la pantalla (si no está, se muestra el id).
const MODEL_LABELS: Record<string, string> = {
  'gemini-3.5-flash-lite': 'Gemini 3.5 Flash-Lite',
  'gemini-3.8-flash': 'Gemini 3.8 Flash',
  'claude-haiku-5-5': 'Claude Haiku 5.5',
  'claude-sonnet-5-5': 'Claude Sonnet 5.5',
};

export interface ModelOption {
  id: string;
  label: string;
}

// Respuesta de GET /api/extraction/settings: qué IA analiza los CVs. Nunca incluye claves.
export interface ExtractionSettings {
  provider: 'gemini' | 'claude';
  providerLabel: string;
  model: ModelOption;
  // false si falta la clave del proveedor activo en api/.env (los CVs quedarán en error "IA no configurada").
  apiKeyConfigured: boolean;
  // Modelo para analizar de nuevo un CV puntual. Solo existe con Claude; con Gemini es null.
  alternativeModel: ModelOption | null;
}

const option = (id: string): ModelOption => ({ id, label: MODEL_LABELS[id] ?? id });

export function getExtractionSettings(): ExtractionSettings {
  const { provider, model, apiKeyConfigured, alternativeModel } = config.extraction;
  return {
    provider,
    providerLabel: provider === 'gemini' ? 'Gemini (Google)' : 'Claude (Anthropic)',
    model: option(model),
    apiKeyConfigured,
    alternativeModel: alternativeModel === null ? null : option(alternativeModel),
  };
}
