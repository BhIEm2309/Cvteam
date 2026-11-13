import type { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface StatCardProps {
  label: string
  value: string
  detail: string
  icon: LucideIcon
  // Clases de color para el ícono, por ejemplo "text-red-400 bg-red-400/10".
  iconClass: string
}

// Tarjeta con un número destacado (indicador).
export function StatCard({ label, value, detail, icon: Icon, iconClass }: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{label}</p>
          <p className="mt-2 text-4xl font-semibold text-foreground">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </div>
        <div className={`flex size-9 items-center justify-center rounded-lg ${iconClass}`}>
          <Icon className="size-4" />
        </div>
      </CardContent>
    </Card>
  )
}
