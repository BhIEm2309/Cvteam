import { Sparkles, X } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/shared/ui/avatar'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Progress } from '@/shared/ui/progress'
import { Separator } from '@/shared/ui/separator'
import { FIT_STATUS_COLORS, FIT_STATUS_LABELS } from '../constants'
import type { Collaborator, FitStatus } from '../types'
import { getInitials } from '@/shared/lib/format'
import { RadarChart } from './RadarChart'

interface ProfilePanelProps {
  collaborator: Collaborator
  onClose: () => void
}

// Recomendación de ejemplo según el estado de ajuste al cargo.
const RECOMMENDATIONS: Record<FitStatus, string> = {
  optimo: 'Candidata o candidato a promoción',
  critico: 'Revisar asignación del cargo o plan de capacitación',
  desaprovechado: 'Evaluar un cargo con mayor responsabilidad',
}

// Panel con el perfil del colaborador seleccionado: competencias actuales vs. exigidas por el cargo.
export function ProfilePanel({ collaborator, onClose }: ProfilePanelProps) {
  const colors = FIT_STATUS_COLORS[collaborator.status]

  return (
    <Card>
      <CardContent className="flex flex-col gap-5">
        {/* Encabezado */}
        <div className="flex items-start justify-between">
          <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Perfil seleccionado</p>
          <Button variant="ghost" size="icon" className="size-7" onClick={onClose} aria-label="Cerrar perfil">
            <X />
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <Avatar className="size-11">
            <AvatarFallback className="bg-secondary text-primary">{getInitials(collaborator.fullName)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-lg font-semibold text-foreground">{collaborator.fullName}</p>
            <p className="text-sm text-muted-foreground">{collaborator.position}</p>
          </div>
        </div>

        <div className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
            <Sparkles className="size-4" /> Recomendación
          </p>
          <p className="text-sm text-foreground">{RECOMMENDATIONS[collaborator.status]}</p>
        </div>

        <Separator />

        {/* Gráfico de radar */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Mapa de competencias</p>
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span className="text-primary">— Actual</span>
              <span>- - Requerido</span>
            </div>
          </div>
          <RadarChart competencies={collaborator.competencies} />
        </div>

        <Separator />

        {/* Barras por competencia */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Habilidades vs. cargo</p>
          {collaborator.competencies.map((competency) => {
            const difference = competency.current - competency.required
            const differenceText = difference >= 0 ? `+${difference}` : `${difference}`
            const differenceColor = difference >= 0 ? 'text-emerald-400' : 'text-red-400'
            const barColor = difference >= 0 ? 'bg-emerald-400' : 'bg-red-400'

            return (
              <div key={competency.name}>
                <div className="flex justify-between text-sm">
                  <span className="text-foreground">{competency.name}</span>
                  <span>
                    <span className={`mr-2 text-xs ${differenceColor}`}>{differenceText}</span>
                    <span className="text-muted-foreground">{competency.current}</span>
                  </span>
                </div>
                <Progress value={competency.current} className="mt-1 h-1.5 bg-secondary" indicatorClassName={barColor} />
              </div>
            )
          })}
        </div>

        {/* Ajuste global */}
        <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/50 px-4 py-3">
          <div>
            <p className="text-xs text-muted-foreground">Ajuste global al cargo</p>
            <p className={`text-3xl font-semibold ${colors.text}`}>{collaborator.fitPercent}%</p>
          </div>
          <Badge variant="outline" className={colors.badge}>
            {FIT_STATUS_LABELS[collaborator.status]}
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}
