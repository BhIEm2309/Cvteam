import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { config } from '../../config';
import { ExtractionService } from './extraction.service';

/**
 * Proceso en segundo plano que analiza los CVs en cola (extraction_runs con estado QUEUED).
 *
 * La cola es la propia base de datos: no hace falta Redis. Cada EXTRACTION_POLL_MS revisa si hay
 * trabajo y procesa los CVs de a uno. Con EXTRACTION_WORKER=off no se procesa nada (quedan en cola).
 */
@Injectable()
export class ExtractionWorker implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(ExtractionWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private busy = false;
  private stopping = false;

  constructor(private readonly extraction: ExtractionService) {}

  onApplicationBootstrap(): void {
    if (!config.extraction.workerEnabled) {
      this.logger.warn('EXTRACTION_WORKER=off: los CVs quedan en cola sin analizarse.');
      return;
    }
    const { provider, apiKeyConfigured, apiKeyVariable, model, legacyModelVariable } = config.extraction;
    if (!apiKeyConfigured) {
      this.logger.warn(`Falta ${apiKeyVariable}: los CVs se marcarán con error "IA no configurada".`);
    }
    if (legacyModelVariable) {
      this.logger.warn('EXTRACTION_MODEL cambió de nombre a CLAUDE_MODEL (solo se usa con EXTRACTION_PROVIDER=claude). Cambia el nombre en api/.env.');
    }
    this.logger.log(`Análisis de CVs activo (${provider === 'gemini' ? 'Gemini' : 'Claude'}, modelo ${model}).`);
    this.timer = setInterval(() => void this.tick(), config.extraction.pollIntervalMs);
    void this.tick();
  }

  onModuleDestroy(): void {
    this.stopping = true;
    if (this.timer !== null) {
      clearInterval(this.timer);
    }
  }

  private async tick(): Promise<void> {
    // Si el análisis anterior sigue en curso, no se empieza otro.
    if (this.busy || this.stopping) {
      return;
    }
    this.busy = true;
    try {
      await this.extraction.recoverInterruptedRuns();
      // Procesa todo lo que haya en cola, de a uno.
      while (!this.stopping && (await this.extraction.processNextRun())) {
        // sigue con el siguiente
      }
    } catch (error) {
      // Por ejemplo, la base no responde: se reintenta en la próxima vuelta.
      this.logger.error('No se pudo revisar la cola de análisis', error instanceof Error ? error.message : String(error));
    } finally {
      this.busy = false;
    }
  }
}
