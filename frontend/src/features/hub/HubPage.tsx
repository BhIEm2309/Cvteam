import { useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { SampleDataNotice } from '@/shared/components/SampleDataNotice'
import { OrganizationCard } from './components/OrganizationCard'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { SAMPLE_ORGANIZATIONS } from './mock'

const ALL_SECTORS = 'todos'

// Página Hub: lista de organizaciones clientes, con búsqueda y filtro por sector.
export function HubPage() {
  const [searchText, setSearchText] = useState('')
  const [selectedSector, setSelectedSector] = useState(ALL_SECTORS)

  // Lista de sectores sin repetir, para el filtro.
  const sectors: string[] = []
  for (const organization of SAMPLE_ORGANIZATIONS) {
    if (!sectors.includes(organization.sector)) {
      sectors.push(organization.sector)
    }
  }

  // Organizaciones que cumplen la búsqueda y el filtro.
  const visibleOrganizations = SAMPLE_ORGANIZATIONS.filter((organization) => {
    const matchesSearch = organization.name.toLowerCase().includes(searchText.trim().toLowerCase())
    const matchesSector = selectedSector === ALL_SECTORS || organization.sector === selectedSector
    return matchesSearch && matchesSector
  })

  return (
    <div>
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

      <SampleDataNotice />

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
