import { Info } from 'lucide-react'

// Aviso para las páginas que todavía muestran datos de ejemplo (no vienen de la API).
// Cuando una página se conecte a la API, se quita este aviso.
export function SampleDataNotice() {
  return (
    <div className="mb-6 flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
      <Info className="mt-0.5 size-4 shrink-0" />
      <p>
        Vista con <strong>datos de ejemplo</strong>. Esta sección todavía no está conectada a la API; sirve para mostrar
        cómo funcionará.
      </p>
    </div>
  )
}
