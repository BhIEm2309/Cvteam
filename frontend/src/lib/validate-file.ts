import { z } from 'zod'

// Debe coincidir con MAX_UPLOAD_MB de la API. La API vuelve a validar todo de todas formas.
export const MAX_FILE_SIZE_MB = 10
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

// Reglas que debe cumplir un archivo antes de enviarlo a la API.
const pdfFileSchema = z
  .instanceof(File)
  .refine((file) => file.name.toLowerCase().endsWith('.pdf'), 'Solo se aceptan archivos PDF.')
  .refine((file) => file.size > 0, 'El archivo está vacío.')
  .refine((file) => file.size <= MAX_FILE_SIZE_BYTES, `El archivo supera el tamaño máximo de ${MAX_FILE_SIZE_MB} MB.`)

// Devuelve el mensaje de error, o null si el archivo es válido.
export function validatePdfFile(file: File): string | null {
  const result = pdfFileSchema.safeParse(file)

  if (result.success) {
    return null
  }

  return result.error.issues[0]?.message ?? 'Archivo inválido.'
}
