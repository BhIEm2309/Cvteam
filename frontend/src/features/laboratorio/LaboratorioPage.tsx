import { PageHeader } from '@/shared/components/PageHeader'
import { SampleDataNotice } from '@/shared/components/SampleDataNotice'
import { OrgChart } from './components/OrgChart'
import { Card, CardContent } from '@/shared/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { CURRENT_STRUCTURE, PROPOSED_STRUCTURE } from './mock'

// Leyenda: qué significa cada color del organigrama.
const LEGEND_ITEMS = [
  { label: 'Rol asumiendo funciones ajenas', className: 'border-red-400' },
  { label: 'Rol faltante', className: 'border-dashed border-slate-500' },
  { label: 'Rol existente', className: 'border-sky-400' },
  { label: 'Rol propuesto', className: 'border-emerald-400' },
]

// Página Laboratorio: compara la estructura actual de la empresa con una estructura propuesta.
export function LaboratorioPage() {
  return (
    <div>
      <PageHeader
        title={`Organigrama — ${CURRENT_STRUCTURE.companyName}`}
        description="Estructura actual vs. estructura propuesta."
      />

      <SampleDataNotice />

      <Tabs defaultValue="actual">
        <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <TabsList>
            <TabsTrigger value="actual">Estructura actual</TabsTrigger>
            <TabsTrigger value="propuesta">Estructura propuesta</TabsTrigger>
          </TabsList>

          <div className="flex flex-wrap gap-4">
            {LEGEND_ITEMS.map((item) => (
              <span key={item.label} className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className={`inline-block size-3.5 rounded border-2 ${item.className}`} />
                {item.label}
              </span>
            ))}
          </div>
        </div>

        <Card>
          <CardContent className="py-4">
            <TabsContent value="actual">
              <OrgChart data={CURRENT_STRUCTURE} />
            </TabsContent>
            <TabsContent value="propuesta">
              <OrgChart data={PROPOSED_STRUCTURE} />
            </TabsContent>
          </CardContent>
        </Card>
      </Tabs>
    </div>
  )
}
