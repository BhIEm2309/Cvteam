import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { config } from '../../config';
import { buildUserMessage, PROMPT_VERSION, SYSTEM_PROMPT } from './cv-extraction-prompt';
import { CvExtractionSchema } from './cv-extraction-schema';
import { ExtractionFailure, ExtractionProvider, ProviderResult } from './extraction-provider';

// Margen amplio para la respuesta: un CV largo puede tener muchas competencias.
const MAX_OUTPUT_TOKENS = 16000;

/**
 * Proveedor que usa Claude (Anthropic) mediante el SDK oficial.
 * La clave se lee de ANTHROPIC_API_KEY (api/.env); nunca pasa por el frontend ni se guarda en la base.
 */
export class ClaudeExtractionProvider implements ExtractionProvider {
  readonly providerName = 'anthropic';
  readonly model = config.extraction.claude.model;
  readonly promptVersion = PROMPT_VERSION;

  private client: Anthropic | null = null;

  async extractCvSkills(cvText: string, model: string = this.model): Promise<ProviderResult> {
    const client = this.getClient();

    let response;
    try {
      response = await client.beta.messages.create({
        model,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: buildUserMessage(cvText),
          },
        ],
        // effort va dentro de output_config (https://platform.claude.com/docs/en/build-with-claude/effort).
        // 'medium' es el valor por defecto de Claude Haiku 5.5; se deja explícito.
        output_config: {
          format: betaZodOutputFormat(CvExtractionSchema),
          effort: 'medium',
        },
        // Respaldo en el servidor: si el modelo rechaza la solicitud por sus filtros de seguridad, la API la
        // reintenta con el modelo que Anthropic recomienda (beta; ver
        // https://platform.claude.com/docs/en/build-with-claude/refusals-and-fallback).
        // OJO: Claude Haiku 5.5 NO tiene respaldo en el servidor; con 'default' un rechazo queda como rechazo
        // (no da error). Se mantiene para que funcione si EXTRACTION_MODEL cambia a claude-sonnet-5-5.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
      });
    } catch (error) {
      throw this.toFailure(error);
    }

    if (response.stop_reason === 'refusal') {
      throw new ExtractionFailure('IA_RECHAZO', 'La IA no quiso analizar este documento. Revisa que sea un CV.');
    }
    if (response.stop_reason === 'max_tokens') {
      throw new ExtractionFailure('IA_RESPUESTA_INVALIDA', 'La respuesta de la IA quedó incompleta.');
    }

    // Se lee el JSON y se valida contra el esquema. Se hace aquí (y no con el helper parse del SDK)
    // para revisar antes stop_reason: un rechazo llega sin JSON y debe informarse como rechazo.
    const text = response.content
      .map((block) => (block.type === 'text' ? block.text : ''))
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
    // response.model es el modelo que respondió: si actuó el respaldo, no es el configurado.
    return { extraction: result.data, respondedModel: response.model };
  }

  private getClient(): Anthropic {
    if (!config.extraction.claude.apiKeyConfigured) {
      throw new ExtractionFailure(
        'IA_NO_CONFIGURADA',
        'La IA no está configurada: falta ANTHROPIC_API_KEY en api/.env. El CV quedó guardado; analízalo de nuevo después de configurarla.',
      );
    }
    if (this.client === null) {
      // timeout en milisegundos. El SDK reintenta 2 veces ante errores temporales (429, 5xx, red).
      this.client = new Anthropic({ timeout: 5 * 60 * 1000, maxRetries: 2 });
    }
    return this.client;
  }

  // Traduce los errores del SDK a códigos estables, de lo más específico a lo más general.
  private toFailure(error: unknown): ExtractionFailure {
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      return new ExtractionFailure('IA_CLAVE_INVALIDA', 'La clave de la IA (ANTHROPIC_API_KEY) no es válida o no tiene permisos.');
    }
    if (
      error instanceof Anthropic.RateLimitError ||
      error instanceof Anthropic.InternalServerError ||
      error instanceof Anthropic.APIConnectionError
    ) {
      return new ExtractionFailure('IA_NO_DISPONIBLE', 'El servicio de IA no respondió. Intenta analizar el CV de nuevo en unos minutos.');
    }
    if (error instanceof Anthropic.APIError) {
      return new ExtractionFailure('ERROR_INTERNO', `El servicio de IA rechazó la solicitud (código ${error.status ?? 'desconocido'}).`);
    }
    return new ExtractionFailure('IA_RESPUESTA_INVALIDA', 'No se pudo leer la respuesta de la IA.');
  }
}
