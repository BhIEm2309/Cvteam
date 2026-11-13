import { Info } from 'lucide-react'
import type { MockReason } from '@/shared/lib/load-data'

// Motivo por el que la pantalla muestra datos de ejemplo.
const REASON_TEXT: Record<MockReason, string> = {
  'modo-mock': 'La aplicación está en modo de ejemplo (VITE_DATA_MODE=mock): no se consulta la API.',
  'api-no-disponible': 'La API no responde, así que se muestran datos de ejemplo. Revisa que esté funcionando.',
  'ruta-no-existe': 'Esta sección todavía no existe en la API; sirve para mostrar cómo funcionará.',
}

interface SampleDataNoticeProps {
  reason: MockReason
  // true en pantallas donde se puede escribir (por ejemplo subir un CV): las acciones se simulan.
  simulatesWrites?: boolean
}

// Aviso amarillo para las pantallas que muestran datos de ejemplo (no vienen de la API).
export function SampleDataNotice({ reason, simulatesWrites = false }: SampleDataNoticeProps) {
  return (
    <div className="mb-6 flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
      <Info className="mt-0.5 size-4 shrink-0" />
      <p>
        Vista con <strong>datos de ejemplo</strong>. {REASON_TEXT[reason]}
        {simulatesWrites && (
          <>
            {' '}
            <strong>Lo que subas se simula en memoria y se pierde al recargar.</strong>
          </>
        )}
      </p>
    </div>
  )
}
