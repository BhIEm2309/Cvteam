import { useState } from 'react'
import { AlertTriangle, TrendingDown, Users } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { SampleDataNotice } from '@/shared/components/SampleDataNotice'
import { StatCard } from '@/shared/components/StatCard'
import { TalentTable } from './components/TalentTable'
import { ProfilePanel } from './components/ProfilePanel'
import { Card, CardContent } from '@/shared/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { FIT_STATUS_LABELS, SAMPLE_COLLABORATORS, type FitStatus } from './mock'

const ALL = 'todos'

// Página Directorio de Talento: competencias de cada persona vs. lo que exige su cargo.
export function DirectorioPage() {
  const [selectedArea, setSelectedArea] = useState(ALL)
  const [selectedStatus, setSelectedStatus] = useState(ALL)
  const [selectedId, setSelectedId] = useState<string | null>(SAMPLE_COLLABORATORS[0]?.id ?? null)

  // Lista de áreas sin repetir, para el filtro.
  const areas: string[] = []
  for (const collaborator of SAMPLE_COLLABORATORS) {
    if (!areas.includes(collaborator.area)) {
      areas.push(collaborator.area)
    }
  }

  // Colaboradores que cumplen los filtros.
  const visibleCollaborators = SAMPLE_COLLABORATORS.filter((collaborator) => {
    const matchesArea = selectedArea === ALL || collaborator.area === selectedArea
    const matchesStatus = selectedStatus === ALL || collaborator.status === selectedStatus
    return matchesArea && matchesStatus
  })

  // Indicadores calculados con todos los colaboradores.
  const total = SAMPLE_COLLABORATORS.length
  const criticalCount = SAMPLE_COLLABORATORS.filter((collaborator) => collaborator.status === 'critico').length
  const underusedCount = SAMPLE_COLLABORATORS.filter((collaborator) => collaborator.status === 'desaprovechado').length
  const criticalPercent = Math.round((criticalCount / total) * 100)
  const underusedPercent = Math.round((underusedCount / total) * 100)

  const selectedCollaborator = SAMPLE_COLLABORATORS.find((collaborator) => collaborator.id === selectedId)
  const statusOptions: FitStatus[] = ['optimo', 'critico', 'desaprovechado']

  return (
    <div>
      <PageHeader title="Directorio de Talento" description="Mapeo de competencias vs. exigencias del cargo." />

      <SampleDataNotice />

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          {/* Indicadores */}
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard
              label="Total colaboradores"
              value={String(total)}
              detail="Personas registradas"
              icon={Users}
              iconClass="bg-primary/10 text-primary"
            />
            <StatCard
              label="Desajustes detectados"
              value={String(criticalCount)}
              detail={`${criticalPercent}% del equipo total`}
              icon={AlertTriangle}
              iconClass="bg-red-400/10 text-red-400"
            />
            <StatCard
              label="Talentos subutilizados"
              value={String(underusedCount)}
              detail={`${underusedPercent}% por encima de su cargo`}
              icon={TrendingDown}
              iconClass="bg-amber-400/10 text-amber-300"
            />
          </div>

          {/* Filtros */}
          <Card className="py-4">
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <span className="text-sm text-muted-foreground">Filtrar por</span>
              <Select value={selectedArea} onValueChange={setSelectedArea}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todas las áreas</SelectItem>
                  {areas.map((area) => (
                    <SelectItem key={area} value={area}>
                      {area}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-full sm:w-52">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos los estados</SelectItem>
                  {statusOptions.map((status) => (
                    <SelectItem key={status} value={status}>
                      {FIT_STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground sm:ml-auto">{visibleCollaborators.length} resultados</span>
            </CardContent>
          </Card>

          <TalentTable collaborators={visibleCollaborators} selectedId={selectedId} onSelect={setSelectedId} />
        </div>

        {selectedCollaborator && (
          <ProfilePanel collaborator={selectedCollaborator} onClose={() => setSelectedId(null)} />
        )}
      </div>
    </div>
  )
}
