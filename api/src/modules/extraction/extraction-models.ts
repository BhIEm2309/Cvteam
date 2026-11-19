import { BadRequestException } from '@nestjs/common';
import { config } from '../../config';

// Modelo configurado del proveedor activo y, solo con Claude, el alternativo.
export interface ModelSettings {
  model: string;
  alternativeModel: string | null;
}

// Modelos que se pueden pedir al analizar de nuevo un CV: el configurado y, si existe, el alternativo.
// El navegador solo elige entre estos; nunca puede pedir un modelo cualquiera (cada modelo tiene otro costo).
export function allowedExtractionModels(settings: ModelSettings = config.extraction): string[] {
  return [...new Set([settings.model, ...(settings.alternativeModel === null ? [] : [settings.alternativeModel])])];
}

// Lee { "model": "..." } del cuerpo de POST /api/documents/:id/extraction. Sin cuerpo o sin "model" = null
// (se usa el configurado).
export function readRequestedModel(body: unknown, settings: ModelSettings = config.extraction): string | null {
  if (body === undefined || body === null || (typeof body === 'object' && !Array.isArray(body) && !('model' in body))) {
    return null;
  }
  if (typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestException('El cuerpo debe ser un objeto JSON.');
  }
  const model = (body as { model?: unknown }).model;
  if (model === null || model === undefined || model === '') {
    return null;
  }
  const allowed = allowedExtractionModels(settings);
  if (typeof model !== 'string' || !allowed.includes(model)) {
    throw new BadRequestException(`"model" debe ser uno de: ${allowed.join(', ')}.`);
  }
  return model;
}

// Modelo con el que se procesa un análisis en cola. Si el modelo guardado ya no pertenece al proveedor activo
// (por ejemplo, se pidió claude-sonnet-5-5 y después se cambió EXTRACTION_PROVIDER a gemini), se usa el
// configurado: mandar un modelo de Claude a Gemini solo produciría un error.
export function modelForRun(queuedModel: string | null, settings: ModelSettings = config.extraction): string {
  return queuedModel !== null && allowedExtractionModels(settings).includes(queuedModel) ? queuedModel : settings.model;
}
