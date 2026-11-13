import { ExtractionFailure } from './extraction-provider';

// unpdf solo se publica como módulo ES. Node 22+ permite cargarlo con require; el tipo se toma del paquete.
type Unpdf = typeof import('unpdf', { with: { 'resolution-mode': 'import' } });
// eslint-disable-next-line @typescript-eslint/no-require-imports
const unpdf = require('unpdf') as Unpdf;

// Se guarda en extraction_runs.parser_version. Cambiarla si cambia la forma de leer el PDF.
export const PARSER_VERSION = 'unpdf-2.1.0';

// Un CV con menos letras que esto probablemente es una imagen escaneada (sin texto).
const MIN_TEXT_CHARS = 80;
// Límite para no enviar documentos enormes a la IA (~60 páginas de texto). No se recorta: se informa.
export const MAX_TEXT_CHARS = 120_000;

// Extrae el texto de un PDF. Lanza ExtractionFailure si no se puede leer o no tiene texto.
export async function extractPdfText(pdf: Buffer): Promise<string> {
  let text: string;
  try {
    const document = await unpdf.getDocumentProxy(new Uint8Array(pdf));
    const result = await unpdf.extractText(document, { mergePages: true });
    text = result.text;
  } catch {
    throw new ExtractionFailure('PDF_ILEGIBLE', 'No se pudo leer el PDF. Puede estar dañado o protegido con contraseña.');
  }

  const cleaned = cleanText(text);
  if (cleaned.replace(/\s/g, '').length < MIN_TEXT_CHARS) {
    throw new ExtractionFailure(
      'PDF_SIN_TEXTO',
      'El PDF no tiene texto legible (probablemente es una imagen escaneada). Sube una versión con texto seleccionable.',
    );
  }
  if (cleaned.length > MAX_TEXT_CHARS) {
    throw new ExtractionFailure(
      'CV_DEMASIADO_LARGO',
      `El documento tiene ${cleaned.length} caracteres de texto; el máximo para analizar es ${MAX_TEXT_CHARS}.`,
    );
  }
  return cleaned;
}

// Quita espacios repetidos al final de cada línea y líneas vacías de más. No cambia las palabras.
export function cleanText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
