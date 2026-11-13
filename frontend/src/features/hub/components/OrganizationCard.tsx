import { Building2, Briefcase, Users } from 'lucide-react'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Separator } from '@/shared/ui/separator'
import { SECTOR_COLORS, type SampleOrganization } from '../mock'
import { formatNumber } from '@/shared/lib/format'

interface OrganizationCardProps {
  organization: SampleOrganization
}

// Tarjeta con el resumen de una organización.
export function OrganizationCard({ organization }: OrganizationCardProps) {
  const sectorColor = SECTOR_COLORS[organization.sector] ?? 'text-muted-foreground'

  return (
    <Card className="transition-colors hover:border-primary/50">
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg border border-border bg-secondary">
              <Building2 className="size-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground">{organization.name}</p>
              <p className="text-xs text-muted-foreground">{organization.taxId}</p>
            </div>
          </div>
          <Badge variant="outline" className={sectorColor}>
            {organization.sector}
          </Badge>
        </div>

        <Separator />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="size-3.5" /> Empleados
            </p>
            <p className="text-2xl font-semibold text-foreground">{formatNumber(organization.employees)}</p>
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Briefcase className="size-3.5" /> Roles activos
            </p>
            <p className="text-2xl font-semibold text-primary">{organization.activeRoles}</p>
          </div>
        </div>

        {/* Deshabilitado hasta que exista la vista de detalle de una organización. */}
        <Button variant="secondary" disabled title="Próximamente">
          Ver detalle
        </Button>
      </CardContent>
    </Card>
  )
}
