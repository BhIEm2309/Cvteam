import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/shared/components/PageHeader'
import { SampleDataNotice } from '@/shared/components/SampleDataNotice'
import { LoadState } from '@/shared/components/LoadState'
import { Card, CardContent } from '@/shared/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { getSourceStatus, useReportSourceStatus } from '@/shared/lib/data-source'
import { OrgChart } from './components/OrgChart'
import { PositionTree } from './components/PositionTree'
import { ProposedStructure } from './components/ProposedStructure'
import { getCurrentOrgChart, getLatestDiagnostic, getProposedOrgChart } from './api'
import type { CurrentOrgChart } from './types'

// Leyenda de cada pestaña: qué significa cada color.
const CURRENT_LEGEND = [
  { label: 'Cargo con personas', className: 'border-sky-400' },
  { label: 'Cargo sin personas asignadas', className: 'border-dashed border-slate-500' },
]
// Estructura propuesta real (diagnóstico).
const PROPOSED_LEGEND = [
  { label: 'Cargo con propuesta de persona', className: 'border-emerald-400' },
  { label: 'Vacante sin candidato', className: 'border-dashed border-slate-500' },
  { label: 'Cargo sin cambios propuestos', className: 'border-sky-400' },
]
// Ejemplo (modo mock y lo que todavía no se calcula).
const EXAMPLE_LEGEND = [
  { label: 'Rol asumiendo funciones ajenas', className: 'border-red-400' },
  { label: 'Rol faltante', className: 'border-dashed border-slate-500' },
  { label: 'Rol existente', className: 'border-sky-400' },
  { label: 'Rol propuesto', className: 'border-emerald-400' },
]

// Página Laboratorio: estructura actual (datos reales de cargos y personas) vs. estructura propuesta (último
// diagnóstico, con reglas explicables). Lo que todavía no se calcula (funciones ajenas) se muestra como ejemplo.
export function LaboratorioPage() {
  // Estructura actual desde la API o, según el modo de datos, desde los datos de ejemplo.
  const currentQuery = useQuery({ queryKey: ['org-chart', 'current'], queryFn: getCurrentOrgChart })
  // La barra superior indica la fuente de la estructura actual; la propuesta siempre es de ejemplo y lo avisa aparte.
  useReportSourceStatus('/laboratorio', getSourceStatus(currentQuery))
  const diagnosticQuery = useQuery({ queryKey: ['diagnostics', 'latest'], queryFn: getLatestDiagnostic })
  const example = getProposedOrgChart()

  if (!currentQuery.data) {
    return (
      <div>
        <PageHeader title="Organigrama" description="Estructura actual vs. estructura propuesta." />
        <LoadState isPending={currentQuery.isPending} error={currentQuery.error} />
      </div>
    )
  }

  const current = currentQuery.data.data

  return (
    <div>
      <PageHeader title={`Organigrama — ${current.organizationName}`} description="Estructura actual vs. estructura propuesta." />

      <Tabs defaultValue="actual">
        <TabsList className="mb-4">
          <TabsTrigger value="actual">Estructura actual</TabsTrigger>
          <TabsTrigger value="propuesta">Estructura propuesta</TabsTrigger>
        </TabsList>

        <TabsContent value="actual">
          {currentQuery.data.source === 'mock' && <SampleDataNotice reason={currentQuery.data.reason} />}
          <TabHeader legend={CURRENT_LEGEND}>
            <CurrentTotals chart={current} />
          </TabHeader>
          <Card>
            <CardContent className="py-4">
              {current.positions.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Todavía no hay cargos. Importa el organigrama (CSV) en{' '}
                  <Link to="/ingesta" className="text-primary underline-offset-2 hover:underline">
                    Ingesta
                  </Link>
                  .
                </p>
              ) : (
                <PositionTree positions={current.positions} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="propuesta">
          {diagnosticQuery.data?.source === 'api' ? (
            <>
              <TabHeader legend={PROPOSED_LEGEND} />
              <ProposedStructure current={current} run={diagnosticQuery.data.data.run} />
              {/* Lo que todavía no se calcula: plegado y con su aviso, para no confundirlo con la propuesta real. */}
              <details className="mt-6">
                <summary className="cursor-pointer text-sm text-muted-foreground">
                  Ejemplo: roles que asumen funciones ajenas (todavía no se calcula)
                </summary>
                <div className="mt-3">
                  <SampleDataNotice detail="Detectar funciones ajenas necesita la encuesta de funciones reales, que todavía no existe. Esto es un ejemplo de cómo se verá." />
                  <TabHeader legend={EXAMPLE_LEGEND} />
                  <Card>
                    <CardContent className="py-4">
                      <OrgChart data={example} />
                    </CardContent>
                  </Card>
                </div>
              </details>
            </>
          ) : diagnosticQuery.data?.source === 'mock' ? (
            <>
              <SampleDataNotice reason={diagnosticQuery.data.reason} />
              <TabHeader legend={EXAMPLE_LEGEND} />
              <Card>
                <CardContent className="py-4">
                  <OrgChart data={example} />
                </CardContent>
              </Card>
            </>
          ) : (
            <LoadState isPending={diagnosticQuery.isPending} error={diagnosticQuery.error} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function TabHeader({ legend, children }: { legend: { label: string; className: string }[]; children?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div>{children}</div>
      <div className="flex flex-wrap gap-4">
        {legend.map((item) => (
          <span key={item.label} className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className={`inline-block size-3.5 rounded border-2 ${item.className}`} />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  )
}

// Resumen: cargos, personas y vacantes a la fecha del cálculo.
function CurrentTotals({ chart }: { chart: CurrentOrgChart }) {
  const { totals } = chart
  const [year, month, day] = chart.asOf.split('-')
  const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`
  return (
    <p className="text-sm text-muted-foreground">
      {plural(totals.positions, 'cargo', 'cargos')} · {plural(totals.people, 'persona', 'personas')} ·{' '}
      <span className={totals.vacancies > 0 ? 'text-amber-300' : undefined}>
        {plural(totals.vacancies, 'vacante', 'vacantes')}
      </span>
      {totals.overstaffed > 0 && <> · {plural(totals.overstaffed, 'cargo con sobredotación', 'cargos con sobredotación')}</>} · al{' '}
      {day}-{month}-{year}
    </p>
  )
}
