import { Prisma, RunStatus } from '@prisma/client';
import { OUTPUT_SCHEMA_VERSION } from './cv-extraction-schema';
import { PARSER_VERSION } from './pdf-text';

// Estado del análisis tal como lo ve el frontend.
//   PENDING_ANALYSIS: nunca se pidió (por ejemplo, perfiles de cargo, que todavía no se analizan).
export type AnalysisStatus = 'PENDING_ANALYSIS' | 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export function toAnalysisStatus(runStatus: RunStatus | null | undefined): AnalysisStatus {
  switch (runStatus) {
    case 'QUEUED':
      return 'QUEUED';
    case 'RUNNING':
      return 'PROCESSING';
    case 'SUCCEEDED':
      return 'COMPLETED';
    case 'FAILED':
      return 'FAILED';
    default:
      // Sin análisis o cancelado.
      return 'PENDING_ANALYSIS';
  }
}

/**
 * Deja en cola el análisis de una versión de documento (crea una fila QUEUED en extraction_runs).
 * Se llama dentro de una transacción: al subir un CV o al pedir analizarlo de nuevo.
 * El proceso en segundo plano (ExtractionWorker) la toma después.
 *
 * model: modelo elegido para este análisis (null = el configurado en EXTRACTION_MODEL al momento de procesarlo).
 * Se guarda en extraction_runs.model mientras espera; al terminar, esa columna pasa a tener el modelo que respondió.
 */
export async function queueExtraction(
  tx: Prisma.TransactionClient,
  organizationId: string,
  documentVersionId: string,
  model: string | null = null,
): Promise<{ id: string }> {
  // Cada pedido de análisis es una ejecución nueva. La clave la hace única por versión y número de intento.
  const previousRuns = await tx.extractionRun.count({ where: { organizationId, documentVersionId } });

  return tx.extractionRun.create({
    data: {
      organizationId,
      documentVersionId,
      status: 'QUEUED',
      model,
      idempotencyKey: `cv:${documentVersionId}:${previousRuns + 1}`,
      parserVersion: PARSER_VERSION,
      outputSchemaVersion: OUTPUT_SCHEMA_VERSION,
    },
    select: { id: true },
  });
}
