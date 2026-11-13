import { useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { SampleDataNotice } from '@/shared/components/SampleDataNotice'
import { OrganizationCard } from './components/OrganizationCard'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { useQuery } from '@tanstack/react-query'
import { LoadState } from '@/shared/components/LoadState'
import { getSourceStatus, useReportSourceStatus } from '@/shared/lib/data-source'
import { getOrganizations } from './api'

const ALL_SECTORS = 'todos'

// Página Hub: lista de organizaciones clientes, con búsqueda y filtro por sector.
export function HubPage() {
  const [searchText, setSearchText] = useState('')
  const [selectedSector, setSelectedSector] = useState(ALL_SECTORS)

  // Organizaciones desde la API o, según el modo de datos, desde los datos de ejemplo.
  const organizationsQuery = useQuery({ queryKey: ['organizations'], queryFn: getOrganizations })
  useReportSourceStatus('/hub', getSourceStatus(organizationsQuery))
  const organizations = organizationsQuery.data?.data ?? []

  // Lista de sectores sin repetir, para el filtro.
  const sectors: string[] = []
  for (const organization of organizations) {
    if (!sectors.includes(organization.sector)) {
      sectors.push(organization.sector)
    }
  }

  // Organizaciones que cumplen la búsqueda y el filtro.
  const visibleOrganizations = organizations.filter((organization) => {
    const matchesSearch = organization.name.toLowerCase().includes(searchText.trim().toLowerCase())
    const matchesSector = selectedSector === ALL_SECTORS || organization.sector === selectedSector
    return matchesSearch && matchesSector
  })

  const header = (
    <>
      <p className="mb-1 text-xs font-semibold tracking-widest text-primary uppercase">Hub de organizaciones</p>
      <PageHeader
        title="Organizaciones"
        description="Empresas clientes y el estado de su estructura."
        actions={
          <Button disabled title="Próximamente">
            <Plus /> Nueva organización
          </Button>
        }
      />
    </>
  )

  // Mientras carga, o si la API respondió con un error, no se muestra la lista.
  if (!organizationsQuery.data) {
    return (
      <div>
        {header}
        <LoadState isPending={organizationsQuery.isPending} error={organizationsQuery.error} />
      </div>
    )
  }

  return (
    <div>
      {header}

      {organizationsQuery.data.source === 'mock' && <SampleDataNotice reason={organizationsQuery.data.reason} />}

      {/* Búsqueda y filtro */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Buscar organización..."
            className="pl-9"
          />
        </div>
        <Select value={selectedSector} onValueChange={setSelectedSector}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_SECTORS}>Todos los sectores</SelectItem>
            {sectors.map((sector) => (
              <SelectItem key={sector} value={sector}>
                {sector}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{visibleOrganizations.length} organizaciones</span>
      </div>

      {visibleOrganizations.length === 0 && (
        <p className="text-sm text-muted-foreground">No hay organizaciones que coincidan con la búsqueda.</p>
      )}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {visibleOrganizations.map((organization) => (
          <OrganizationCard key={organization.id} organization={organization} />
        ))}
      </div>
    </div>
  )
}
