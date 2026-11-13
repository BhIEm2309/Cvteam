import { CvExtraction } from './cv-extraction-schema';

/**
 * Proveedor de IA que convierte el texto de un CV en competencias.
 *
 * Está detrás de una interfaz para poder cambiarlo (otra API o un modelo local) sin tocar el resto del módulo.
 * El proveedor solo devuelve datos: no escribe en la base.
 */
export interface ExtractionProvider {
  // Se guardan en extraction_runs para saber con qué se hizo cada análisis.
  readonly providerName: string;
  readonly model: string;
  readonly promptVersion: string;

  extractCvSkills(cvText: string): Promise<CvExtraction>;
}

// Token de Nest para inyectar el proveedor configurado.
export const EXTRACTION_PROVIDER = Symbol('EXTRACTION_PROVIDER');

// Códigos estables de error. Se guardan en extraction_runs.error_code y el frontend los muestra.
export type ExtractionErrorCode =
  | 'IA_NO_CONFIGURADA'
  | 'IA_CLAVE_INVALIDA'
  | 'IA_NO_DISPONIBLE'
  | 'IA_RECHAZO'
  | 'IA_RESPUESTA_INVALIDA'
  | 'PDF_ILEGIBLE'
  | 'PDF_SIN_TEXTO'
  | 'CV_DEMASIADO_LARGO'
  | 'ARCHIVO_NO_ENCONTRADO'
  | 'INTERRUMPIDO'
  | 'ERROR_INTERNO';

/**
 * Falla esperada de un análisis. El mensaje se muestra a la persona usuaria:
 * debe estar en español y no incluir secretos (claves, rutas internas).
 */
export class ExtractionFailure extends Error {
  constructor(
    readonly code: ExtractionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ExtractionFailure';
  }
}
