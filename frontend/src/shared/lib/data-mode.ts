import { z } from 'zod'

// Modo de datos de la aplicación (variable VITE_DATA_MODE):
//   auto: llama a la API; usa datos de ejemplo SOLO si la API no responde o la ruta todavía no existe.
//   api:  nunca usa datos de ejemplo (para probar la conexión real).
//   mock: siempre usa datos de ejemplo (para presentar sin backend).
const dataModeSchema = z.enum(['auto', 'api', 'mock'])

export type DataMode = z.infer<typeof dataModeSchema>

function readDataMode(): DataMode {
  const rawValue = import.meta.env.VITE_DATA_MODE

  if (rawValue === undefined || rawValue === '') {
    return 'auto'
  }

  const result = dataModeSchema.safeParse(rawValue)
  if (!result.success) {
    // Se detiene en vez de elegir un modo en silencio: un modo equivocado podría esconder la API real.
    throw new Error(`VITE_DATA_MODE inválido: "${rawValue}". Valores permitidos: auto, api o mock.`)
  }

  return result.data
}

export const DATA_MODE: DataMode = readDataMode()
