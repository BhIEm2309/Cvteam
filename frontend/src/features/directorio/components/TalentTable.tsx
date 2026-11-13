import { Avatar, AvatarFallback } from '@/shared/ui/avatar'
import { Badge } from '@/shared/ui/badge'
import { Card } from '@/shared/ui/card'
import { Progress } from '@/shared/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { FIT_STATUS_COLORS, FIT_STATUS_LABELS, type SampleCollaborator } from '../mock'
import { getInitials } from '@/shared/lib/format'

interface TalentTableProps {
  collaborators: SampleCollaborator[]
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
            <TableHead className="hidden md:table-cell">Habilidades clave</TableHead>
            <TableHead>Ajuste al cargo</TableHead>
            <TableHead className="pr-6">Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
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
                      <p className="text-xs text-muted-foreground">{collaborator.area}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-foreground">{collaborator.position}</TableCell>
                {/* En pantallas chicas se oculta esta columna para que la tabla quepa. */}
                <TableCell className="hidden md:table-cell">
                  <div className="flex max-w-56 flex-wrap gap-1">
                    {collaborator.keySkills.map((skill) => (
                      <Badge key={skill} variant="outline" className="border-primary/30 text-primary">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="w-36">
                    <p className={`text-xs font-semibold ${colors.text}`}>{collaborator.fitPercent}%</p>
                    <Progress
                      value={collaborator.fitPercent}
                      className="mt-1 h-1.5 bg-secondary"
                      indicatorClassName={colors.bar}
                    />
                  </div>
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
