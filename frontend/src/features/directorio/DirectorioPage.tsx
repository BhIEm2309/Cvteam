import { useState } from 'react'
import { AlertTriangle, TrendingDown, Users } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { SampleDataNotice } from '@/shared/components/SampleDataNotice'
import { StatCard } from '@/shared/components/StatCard'
import { TalentTable } from './components/TalentTable'
import { ProfilePanel } from './components/ProfilePanel'
import { Card, CardContent } from '@/shared/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { useQuery } from '@tanstack/react-query'
import { LoadState } from '@/shared/components/LoadState'
import { getSourceStatus, useReportSourceStatus } from '@/shared/lib/data-source'
import { getCollaborators } from './api'
import { FIT_STATUS_LABELS } from './constants'
import type { FitStatus } from './types'

const ALL = 'todos'

// Página Directorio de Talento: competencias de cada persona vs. lo que exige su cargo.
export function DirectorioPage() {
  const [selectedArea, setSelectedArea] = useState(ALL)
  const [selectedStatus, setSelectedStatus] = useState(ALL)
  // undefined: todavía no se elige (se muestra el primero). null: el usuario cerró el panel.
  const [chosenId, setChosenId] = useState<string | null | undefined>(undefined)

  // Colaboradores desde la API o, según el modo de datos, desde los datos de ejemplo.
  const collaboratorsQuery = useQuery({ queryKey: ['collaborators'], queryFn: getCollaborators })
  useReportSourceStatus('/directorio', getSourceStatus(collaboratorsQuery))
  const collaborators = collaboratorsQuery.data?.data ?? []
  const selectedId = chosenId === undefined ? (collaborators[0]?.id ?? null) : chosenId

  // Lista de áreas sin repetir, para el filtro.
  const areas: string[] = []
  for (const collaborator of collaborators) {
    if (!areas.includes(collaborator.area)) {
      areas.push(collaborator.area)
    }
  }

  // Colaboradores que cumplen los filtros.
  const visibleCollaborators = collaborators.filter((collaborator) => {
    const matchesArea = selectedArea === ALL || collaborator.area === selectedArea
    const matchesStatus = selectedStatus === ALL || collaborator.status === selectedStatus
    return matchesArea && matchesStatus
  })

  // Indicadores calculados con todos los colaboradores.
  const total = collaborators.length
  const criticalCount = collaborators.filter((collaborator) => collaborator.status === 'critico').length
  const underusedCount = collaborators.filter((collaborator) => collaborator.status === 'desaprovechado').length
  const criticalPercent = total > 0 ? Math.round((criticalCount / total) * 100) : 0
  const underusedPercent = total > 0 ? Math.round((underusedCount / total) * 100) : 0

  const selectedCollaborator = collaborators.find((collaborator) => collaborator.id === selectedId)
  const statusOptions: FitStatus[] = ['optimo', 'critico', 'desaprovechado']

  const header = <PageHeader title="Directorio de Talento" description="Mapeo de competencias vs. exigencias del cargo." />

  // Mientras carga, o si la API respondió con un error, no se muestra el directorio.
  if (!collaboratorsQuery.data) {
    return (
      <div>
        {header}
        <LoadState isPending={collaboratorsQuery.isPending} error={collaboratorsQuery.error} />
      </div>
    )
  }

  return (
    <div>
      {header}

      {collaboratorsQuery.data.source === 'mock' && <SampleDataNotice reason={collaboratorsQuery.data.reason} />}

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

          <TalentTable collaborators={visibleCollaborators} selectedId={selectedId} onSelect={setChosenId} />
        </div>

        {selectedCollaborator && (
          <ProfilePanel collaborator={selectedCollaborator} onClose={() => setChosenId(null)} />
        )}
      </div>
    </div>
  )
}
