import { Logger } from '@nestjs/common';
import { setTimeout as sleep } from 'node:timers/promises';
import { z } from 'zod';
import { config } from '../../config';
import { buildUserMessage, PROMPT_VERSION, SYSTEM_PROMPT } from './cv-extraction-prompt';
import { CvExtraction, CvExtractionSchema } from './cv-extraction-schema';
import { ExtractionFailure, ExtractionProvider, ProviderResult } from './extraction-provider';

// Esquema JSON que Gemini debe respetar al responder: el mismo contrato de cv-extraction-schema.ts.
// "$schema" se quita porque la documentación de Gemini no lo menciona entre las palabras aceptadas.
const { $schema: _ignored, ...RESPONSE_SCHEMA } = z.toJSONSchema(CvExtractionSchema) as Record<string, unknown>;

// Estados HTTP que indican un problema pasajero de Google: vale la pena reintentar.
// Fuente: https://aistudio.google.com/docs/api-errors y https://aistudio.google.com/docs/troubleshooting
const RETRYABLE_STATUS = new Set([408, 429, 500, 503, 504]);

// Respuesta de la API "interactions" de Gemini (solo los campos que se usan).
interface InteractionResponse {
  status?: string;
  model?: string;
  steps?: { type?: string; content?: { type?: string; text?: string }[] }[];
}

/**
 * Proveedor que usa Gemini (Google) con su API REST "interactions" y salida JSON con esquema.
 *
 * - La clave se lee de GEMINI_API_KEY (api/.env); nunca pasa por el frontend, no se guarda ni se escribe en el registro.
 * - store: false pide a Google no guardar la conversación. OJO: en el plan gratis Google igual puede usar lo enviado
 *   para mejorar sus productos (y revisarlo con personas): usar solo CVs de prueba. Ver api/README.md.
 * - Si Google está saturado (503) o se pasa el límite por minuto (429), reintenta con esperas crecientes
 *   (GEMINI_RETRY_DELAYS_MS). Si sigue fallando, el CV queda en error IA_NO_DISPONIBLE y se puede analizar de nuevo.
 */
export class GeminiExtractionProvider implements ExtractionProvider {
  readonly providerName = 'google';
  readonly model = config.extraction.gemini.model;
  readonly promptVersion = PROMPT_VERSION;

  private readonly logger = new Logger(GeminiExtractionProvider.name);

  async extractCvSkills(cvText: string, model: string = this.model): Promise<ProviderResult> {
    const apiKey = (process.env.GEMINI_API_KEY ?? '').trim();
    if (apiKey === '') {
      throw new ExtractionFailure(
        'IA_NO_CONFIGURADA',
        'La IA no está configurada: falta GEMINI_API_KEY en api/.env. El CV quedó guardado; analízalo de nuevo después de configurarla.',
      );
    }

    const { retryDelaysMs, timeoutMs, baseUrl } = config.extraction.gemini;
    const body = JSON.stringify({
      model,
      store: false,
      system_instruction: SYSTEM_PROMPT,
      input: buildUserMessage(cvText),
      response_format: { type: 'text', mime_type: 'application/json', schema: RESPONSE_SCHEMA },
    });

    for (let attempt = 0; ; attempt++) {
      const canRetry = attempt < retryDelaysMs.length;
      let response: Response;
      try {
        response = await fetch(`${baseUrl}/v1beta/interactions`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
          body,
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch {
        // Sin conexión o se agotó el tiempo.
        if (canRetry) {
          await this.waitBeforeRetry(attempt, 'sin respuesta');
          continue;
        }
        throw new ExtractionFailure('IA_NO_DISPONIBLE', 'No se pudo conectar con Gemini. Revisa la conexión a internet e intenta analizar el CV de nuevo.');
      }

      const responseText = await response.text();
      if (response.ok) {
        return this.readResult(responseText, model);
      }

      const errorCode = readErrorCode(responseText);
      // quota_exceeded = límite DIARIO: reintentar en segundos no sirve.
      if (canRetry && RETRYABLE_STATUS.has(response.status) && errorCode !== 'quota_exceeded') {
        await this.waitBeforeRetry(attempt, `código ${response.status}`);
        continue;
      }
      throw toFailure(response.status, errorCode, model);
    }
  }

  private async waitBeforeRetry(attempt: number, reason: string): Promise<void> {
    const delay = config.extraction.gemini.retryDelaysMs[attempt];
    this.logger.warn(`Gemini no respondió bien (${reason}); reintento ${attempt + 1} en ${delay / 1000} s.`);
    await sleep(delay);
  }

  // Se lee el JSON y se valida contra el esquema: la salida estructurada asegura un JSON válido, no los valores.
  private readResult(responseText: string, requestedModel: string): ProviderResult {
    let interaction: InteractionResponse;
    try {
      interaction = JSON.parse(responseText) as InteractionResponse;
    } catch {
      throw new ExtractionFailure('IA_RESPUESTA_INVALIDA', 'No se pudo leer la respuesta de la IA.');
    }
    if (interaction.status !== undefined && interaction.status !== 'completed') {
      throw new ExtractionFailure(
        'IA_RESPUESTA_INVALIDA',
        interaction.status === 'incomplete' ? 'La respuesta de la IA quedó incompleta.' : `La IA no terminó el análisis (estado "${interaction.status}").`,
      );
    }

    const text = (interaction.steps ?? [])
      .filter((step) => step.type === 'model_output')
      .flatMap((step) => step.content ?? [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text ?? '')
      .join('');
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new ExtractionFailure('IA_RESPUESTA_INVALIDA', 'La respuesta de la IA no es un JSON válido.');
    }
    const result = CvExtractionSchema.safeParse(json);
    if (!result.success) {
      throw new ExtractionFailure('IA_RESPUESTA_INVALIDA', 'La respuesta de la IA no tiene el formato esperado.');
    }
    const extraction: CvExtraction = result.data;
    return { extraction, respondedModel: interaction.model ?? requestedModel };
  }
}

// Código del error de Google ({"error": {"code": "service_unavailable", "message": "..."}}), si viene.
function readErrorCode(responseText: string): string | null {
  try {
    const code = (JSON.parse(responseText) as { error?: { code?: unknown } }).error?.code;
    return typeof code === 'string' ? code : null;
  } catch {
    return null;
  }
}

// Traduce el error de Google a un código estable y un mensaje en español (sin secretos).
function toFailure(status: number, errorCode: string | null, model: string): ExtractionFailure {
  if (status === 401) {
    return new ExtractionFailure('IA_CLAVE_INVALIDA', 'La clave de Gemini (GEMINI_API_KEY) no es válida o venció.');
  }
  if (status === 403) {
    return new ExtractionFailure(
      'IA_CLAVE_INVALIDA',
      'Gemini rechazó la clave (GEMINI_API_KEY): no tiene permisos o fue bloqueada (por ejemplo, si se reportó como filtrada). Crea una nueva en Google AI Studio.',
    );
  }
  if (status === 429) {
    return new ExtractionFailure(
      'IA_NO_DISPONIBLE',
      errorCode === 'quota_exceeded'
        ? 'Se alcanzó el límite diario del plan gratis de Gemini. Intenta analizar el CV de nuevo mañana.'
        : 'Se alcanzó el límite por minuto del plan gratis de Gemini. Intenta analizar el CV de nuevo en unos minutos.',
    );
  }
  if (RETRYABLE_STATUS.has(status)) {
    return new ExtractionFailure('IA_NO_DISPONIBLE', 'Gemini no respondió (alta demanda). Intenta analizar el CV de nuevo en unos minutos.');
  }
  if (status === 404) {
    return new ExtractionFailure('ERROR_INTERNO', `Gemini no encontró el modelo "${model}". Revisa GEMINI_MODEL en api/.env.`);
  }
  return new ExtractionFailure('ERROR_INTERNO', `Gemini rechazó la solicitud (código ${status}).`);
}
