import { useState } from 'react'
import { ListChecks, Pencil, Quote, X } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/shared/ui/avatar'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Progress } from '@/shared/ui/progress'
import { Separator } from '@/shared/ui/separator'
import { getInitials } from '@/shared/lib/format'
import { FIT_STATUS_COLORS, FIT_STATUS_LABELS, MAX_LEVEL, SKILL_CATEGORY_LABELS, VERIFICATION_LABELS } from '../constants'
import type { Collaborator } from '../types'
import { RadarChart, type RadarAxis } from './RadarChart'
import { RequirementsEditor } from './RequirementsEditor'

interface ProfilePanelProps {
  collaborator: Collaborator
  // true si los datos vienen de la API (no de ejemplo): se pueden editar los requisitos del cargo.
  canEditRequirements: boolean
  onClose: () => void
}

// Cantidad máxima de ejes del radar cuando el cargo no tiene requisitos (se muestran las competencias de la persona).
const MAX_RADAR_AXES = 6

// Panel con el perfil de la persona seleccionada: estado, requisitos del cargo y competencias registradas.
export function ProfilePanel({ collaborator, canEditRequirements, onClose }: ProfilePanelProps) {
  const [editing, setEditing] = useState(false)
  const colors = FIT_STATUS_COLORS[collaborator.status]
  const hasRequirements = collaborator.requirements.length > 0

  // Con requisitos: un eje por requisito (actual vs. requerido). Sin requisitos: las competencias con nivel.
  const axes: RadarAxis[] = hasRequirements
    ? collaborator.requirements.map((requirement) => ({
        name: requirement.name,
        current: requirement.currentLevel ?? 0,
        required: requirement.requiredLevel,
      }))
    : collaborator.skills
        .filter((skill) => skill.level !== null)
        .slice(0, MAX_RADAR_AXES)
        .map((skill) => ({ name: skill.name, current: skill.level ?? 0, required: null }))

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
            <p className="text-sm text-muted-foreground">
              {collaborator.position?.title ?? 'Sin cargo'} · {collaborator.area ?? 'Sin área'}
            </p>
          </div>
        </div>

        {/* Ajuste global y su explicación (regla de la API) */}
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-secondary/50 px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Ajuste al cargo</p>
              <p className={`text-3xl font-semibold ${colors.text}`}>
                {collaborator.fitPercent === null ? '—' : `${collaborator.fitPercent}%`}
              </p>
            </div>
            <Badge variant="outline" className={colors.badge}>
              {FIT_STATUS_LABELS[collaborator.status]}
            </Badge>
          </div>
          <ul className="flex list-disc flex-col gap-0.5 pl-4 text-xs text-muted-foreground">
            {collaborator.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>

        {/* Radar: necesita al menos 3 ejes */}
        {axes.length >= 3 && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Mapa de competencias</p>
              <div className="flex gap-3 text-xs text-muted-foreground">
                <span className="text-primary">— Actual</span>
                {hasRequirements && <span>- - Requerido</span>}
              </div>
            </div>
            <RadarChart axes={axes} />
          </div>
        )}

        <Separator />

        {/* Requisitos del cargo */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              <ListChecks className="size-3.5" /> Requisitos del cargo
            </p>
            {collaborator.position && canEditRequirements && !editing && (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <Pencil /> {hasRequirements ? 'Editar' : 'Definir'}
              </Button>
            )}
          </div>

          {editing && collaborator.position ? (
            <RequirementsEditor position={collaborator.position} onDone={() => setEditing(false)} />
          ) : (
            <>
              {!collaborator.position && <p className="text-sm text-muted-foreground">La persona no tiene un cargo vigente.</p>}
              {collaborator.position && !hasRequirements && (
                <p className="text-sm text-muted-foreground">
                  El cargo no tiene requisitos definidos, así que no se calcula el ajuste.
                  {!canEditRequirements && ' Con la API conectada se pueden definir aquí.'}
                </p>
              )}
              {collaborator.requirements.map((requirement) => (
                <div key={requirement.skillId}>
                  <div className="flex justify-between gap-2 text-sm">
                    <span className="text-foreground">
                      {requirement.name}
                      {!requirement.isMandatory && <span className="ml-1 text-xs text-muted-foreground">(deseable)</span>}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {!requirement.hasSkill
                        ? 'No la tiene'
                        : requirement.currentLevel === null
                          ? 'Nivel por confirmar'
                          : `Nivel ${requirement.currentLevel}`}
                      {requirement.requiredLevel !== null && ` / ${requirement.requiredLevel}`}
                    </span>
                  </div>
                  <Progress
                    value={Math.round(requirement.coverage * 100)}
                    className="mt-1 h-1.5 bg-secondary"
                    indicatorClassName={requirement.coverage >= 1 ? 'bg-emerald-400' : requirement.coverage === 0 ? 'bg-red-400' : 'bg-amber-400'}
                  />
                </div>
              ))}
            </>
          )}
        </div>

        <Separator />

        {/* Competencias registradas (confirmadas en la revisión de CVs) */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Competencias registradas ({collaborator.skills.length})
          </p>
          {collaborator.skills.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Sin competencias registradas. Se agregan al revisar las propuestas de la IA de su CV (Ingesta).
            </p>
          )}
          {collaborator.skills.map((skill) => (
            <div key={skill.skillId} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-foreground">{skill.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {skill.level === null ? 'Sin nivel' : `Nivel ${skill.level} de ${MAX_LEVEL}`}
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline" className="text-[10px]">
                  {SKILL_CATEGORY_LABELS[skill.category]}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {VERIFICATION_LABELS[skill.verificationStatus]}
                </Badge>
              </div>
              {skill.evidenceExcerpt && (
                <p className="flex gap-1.5 text-xs text-muted-foreground">
                  <Quote className="mt-0.5 size-3 shrink-0 text-primary" />
                  <span className="italic">{skill.evidenceExcerpt}</span>
                </p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
