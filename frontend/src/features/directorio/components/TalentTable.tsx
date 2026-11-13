import { Avatar, AvatarFallback } from '@/shared/ui/avatar'
import { Badge } from '@/shared/ui/badge'
import { Card } from '@/shared/ui/card'
import { Progress } from '@/shared/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { FIT_STATUS_COLORS, FIT_STATUS_LABELS, KEY_SKILLS_IN_TABLE } from '../constants'
import type { Collaborator } from '../types'
import { getInitials } from '@/shared/lib/format'

interface TalentTableProps {
  collaborators: Collaborator[]
  selectedId: string | null
  onSelect: (collaboratorId: string) => void
}

// Tabla de colaboradores. Al hacer clic en una fila se muestra su perfil a la derecha.
export function TalentTable({ collaborators, selectedId, onSelect }: TalentTableProps) {
  return (
    <Card className="py-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-6">Nombre</TableHead>
            <TableHead>Cargo actual</TableHead>
            <TableHead className="hidden md:table-cell">Competencias principales</TableHead>
            <TableHead>Ajuste al cargo</TableHead>
            <TableHead className="pr-6">Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {collaborators.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                No hay personas que cumplan los filtros.
              </TableCell>
            </TableRow>
          )}
          {collaborators.map((collaborator) => {
            const colors = FIT_STATUS_COLORS[collaborator.status]
            const isSelected = collaborator.id === selectedId

            return (
              <TableRow
                key={collaborator.id}
                onClick={() => onSelect(collaborator.id)}
                className={isSelected ? 'cursor-pointer bg-accent/60' : 'cursor-pointer'}
              >
                <TableCell className="pl-6">
                  <div className="flex items-center gap-3">
                    <Avatar className="size-8">
                      <AvatarFallback className="bg-secondary text-xs text-primary">
                        {getInitials(collaborator.fullName)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-foreground">{collaborator.fullName}</p>
                      <p className="text-xs text-muted-foreground">{collaborator.area ?? 'Sin área'}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className={collaborator.position ? 'text-foreground' : 'text-muted-foreground'}>
                  {collaborator.position?.title ?? 'Sin cargo'}
                </TableCell>
                {/* En pantallas chicas se oculta esta columna para que la tabla quepa. */}
                <TableCell className="hidden md:table-cell">
                  <div className="flex max-w-56 flex-wrap items-center gap-1">
                    {/* Las de mayor nivel primero (la API las entrega ordenadas). */}
                    {collaborator.skills.slice(0, KEY_SKILLS_IN_TABLE).map((skill) => (
                      <Badge key={skill.skillId} variant="outline" className="border-primary/30 text-primary">
                        {skill.name}
                      </Badge>
                    ))}
                    {collaborator.skills.length > KEY_SKILLS_IN_TABLE && (
                      <span className="text-xs text-muted-foreground">+{collaborator.skills.length - KEY_SKILLS_IN_TABLE}</span>
                    )}
                    {collaborator.skills.length === 0 && (
                      <span className="text-xs text-muted-foreground">Sin competencias registradas</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {collaborator.fitPercent === null ? (
                    <p className="w-36 text-xs text-muted-foreground">Sin requisitos</p>
                  ) : (
                    <div className="w-36">
                      <p className={`text-xs font-semibold ${colors.text}`}>{collaborator.fitPercent}%</p>
                      <Progress value={collaborator.fitPercent} className="mt-1 h-1.5 bg-secondary" indicatorClassName={colors.bar} />
                    </div>
                  )}
                </TableCell>
                <TableCell className="pr-6">
                  <Badge variant="outline" className={colors.badge}>
                    {FIT_STATUS_LABELS[collaborator.status]}
                  </Badge>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </Card>
  )
}
