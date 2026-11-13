import { AlertTriangle, Loader2 } from 'lucide-react'

interface LoadStateProps {
  isPending: boolean
  error: Error | null
}

// Muestra "Cargando..." o el error de la API mientras una pantalla no tiene datos.
// Devuelve null cuando ya hay datos, para que la pantalla los muestre.
export function LoadState({ isPending, error }: LoadStateProps) {
  if (error) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <p>
          <strong>No se pudieron cargar los datos.</strong> {error.message}
        </p>
      </div>
    )
  }

  if (isPending) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Cargando...
      </p>
    )
  }

  return null
}
