import { BadRequestException } from '@nestjs/common';
import { config } from '../../config';

// Modelos que se pueden pedir al analizar de nuevo un CV: el configurado (EXTRACTION_MODEL) y el alternativo.
// El navegador solo elige entre estos; nunca puede pedir un modelo cualquiera (cada modelo tiene otro costo).
export function allowedExtractionModels(): string[] {
  return [...new Set([config.extraction.model, config.extraction.alternativeModel])];
}

// Lee { "model": "..." } del cuerpo de POST /api/documents/:id/extraction. Sin cuerpo o sin "model" = null
// (se usa el configurado).
export function readRequestedModel(body: unknown): string | null {
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
  const allowed = allowedExtractionModels();
  if (typeof model !== 'string' || !allowed.includes(model)) {
    throw new BadRequestException(`"model" debe ser uno de: ${allowed.join(', ')}.`);
  }
  return model;
}
