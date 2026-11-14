import { useRef, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2 } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import {
  importOrgChart,
  ORG_CHART_IMPORT_AVAILABLE,
  ORG_CHART_TEMPLATE,
  type OrgChartImportIssue,
  type OrgChartImportResult,
  type OrgChartImportSummary,
} from '../org-chart-import'

type Status =
  | { step: 'idle' }
  | { step: 'working'; mode: 'preview' | 'apply' }
  | { step: 'result'; result: OrgChartImportResult }
  | { step: 'failed'; message: string }

// Importar organigrama desde CSV en dos pasos: "Revisar" (no guarda nada) y "Confirmar" (guarda todo).
export function OrgChartImportCard() {
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<Status>({ step: 'idle' })

  async function run(mode: 'preview' | 'apply') {
    if (!file) return
    setStatus({ step: 'working', mode })
    try {
      const result = await importOrgChart(file, mode)
      setStatus({ step: 'result', result })
      if (result.saved) {
        // Hub muestra cuántas personas y cargos tiene la organización.
        queryClient.invalidateQueries({ queryKey: ['organizations'] })
      }
    } catch (error) {
      setStatus({ step: 'failed', message: error instanceof Error ? error.message : 'No se pudo importar el organigrama.' })
    }
  }

  function chooseFile(selected: File | null) {
    setFile(selected)
    setStatus({ step: 'idle' })
  }

  function downloadTemplate() {
    // El BOM (marca U+FEFF al inicio) hace que Excel reconozca el archivo como UTF-8 y muestre bien los acentos.
    const blob = new Blob([String.fromCharCode(0xfeff) + ORG_CHART_TEMPLATE], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'plantilla-organigrama.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const working = status.step === 'working'
  const result = status.step === 'result' ? status.result : null

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">Importar organigrama (CSV)</CardTitle>
        <Button variant="outline" size="sm" onClick={downloadTemplate}>
          <Download /> Plantilla
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <p className="text-muted-foreground">
          Columnas: <strong className="text-foreground">nombre, cargo, area, jefe_directo</strong> y, opcional,{' '}
          <strong className="text-foreground">codigo</strong> (para distinguir nombres repetidos) y{' '}
          <strong className="text-foreground">dotacion_objetivo</strong> (cuántas personas debería tener el cargo; si
          no viene, se usa la cantidad de personas del archivo). Primero se revisa el archivo sin guardar nada; luego
          confirmas.
        </p>

        {!ORG_CHART_IMPORT_AVAILABLE ? (
          <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-amber-200">
            No disponible en modo de ejemplo (VITE_DATA_MODE=mock): la importación necesita la API y no se simula.
          </p>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
            />
            <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={working}>
              <FileSpreadsheet /> {file ? 'Cambiar archivo' : 'Elegir archivo'}
            </Button>
            <span className="min-w-0 truncate text-muted-foreground">{file ? file.name : 'Ningún archivo elegido'}</span>
            <Button className="sm:ml-auto" onClick={() => run('preview')} disabled={!file || working}>
              {working && status.mode === 'preview' && <Loader2 className="animate-spin" />} Revisar
            </Button>
          </div>
        )}

        {status.step === 'failed' && <Message tone="error">{status.message}</Message>}

        {result && !result.ok && (
          <div className="flex flex-col gap-2">
            <Message tone="error">
              El archivo tiene {result.errors.length} problema(s). No se guardó nada. Corrígelo y vuelve a revisarlo.
            </Message>
            <IssueList issues={result.errors} />
          </div>
        )}

        {result && result.ok && result.summary && (
          <div className="flex flex-col gap-3">
            {result.saved ? (
              <Message tone="success">Organigrama importado: {result.rowCount} personas procesadas.</Message>
            ) : (
              <Message tone="info">
                Revisión lista ({result.rowCount} personas). Todavía no se guardó nada: revisa los cambios y confirma.
              </Message>
            )}
            {result.warnings.length > 0 && (
              <div className="flex flex-col gap-2">
                <Message tone="warning">
                  {result.warnings.length} advertencia(s): no impiden importar, pero revísalas.
                </Message>
                <IssueList issues={result.warnings} />
              </div>
            )}
            <SummaryView summary={result.summary} />
            {!result.saved && (
              <Button onClick={() => run('apply')} disabled={working} className="self-start">
                {working && status.mode === 'apply' && <Loader2 className="animate-spin" />} Confirmar e importar
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function IssueList({ issues }: { issues: OrgChartImportIssue[] }) {
  return (
    <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto pl-1">
      {issues.map((issue, index) => (
        <li key={index} className="text-muted-foreground">
          {issue.lines.length > 0 && (
            <strong className="text-foreground">
              {issue.lines.length === 1 ? 'Fila' : 'Filas'} {issue.lines.join(', ')}:{' '}
            </strong>
          )}
          {issue.message}
        </li>
      ))}
    </ul>
  )
}

function SummaryView({ summary }: { summary: OrgChartImportSummary }) {
  return (
    <div className="flex flex-col gap-2">
      <SummaryList
        title={`Áreas nuevas: ${summary.departments.created.length}`}
        detail={`${summary.departments.existing} ya existían`}
        items={summary.departments.created}
      />
      <SummaryList
        title={`Cargos nuevos: ${summary.positions.created.length}`}
        detail={`${summary.positions.unchanged} sin cambios`}
        items={summary.positions.created.map(
          (p) => `${p.title} (${p.department}) · dotación ${p.targetHeadcount}`,
        )}
      />
      <SummaryList
        title={`Cargos que cambian de jefatura: ${summary.positions.parentChanged.length}`}
        items={summary.positions.parentChanged.map(
          (p) => `${p.title} (${p.department}): ${p.from ?? 'sin jefatura'} → ${p.to ?? 'sin jefatura'}`,
        )}
      />
      <SummaryList
        title={`Cargos que cambian de dotación objetivo: ${summary.positions.headcountChanged.length}`}
        items={summary.positions.headcountChanged.map((p) => `${p.title} (${p.department}): ${p.from} → ${p.to}`)}
      />
      <SummaryList
        title={`Personas nuevas: ${summary.employees.created.length}`}
        detail={`${summary.employees.unchanged} sin cambios`}
        items={summary.employees.created.map((e) => `${e.fullName} — ${e.position}`)}
      />
      <SummaryList
        title={`Personas que cambian de cargo: ${summary.employees.positionChanged.length}`}
        items={summary.employees.positionChanged.map((e) => `${e.fullName}: ${e.from ?? 'sin cargo'} → ${e.to}`)}
      />
      {summary.notInFile.length > 0 && (
        <SummaryList
          title={`Personas que no vienen en el archivo: ${summary.notInFile.length}`}
          detail="no se archivan; revísalas a mano"
          items={summary.notInFile.map((e) => `${e.fullName}${e.position ? ` — ${e.position}` : ''}`)}
          warning
        />
      )}
    </div>
  )
}

function SummaryList({ title, detail, items, warning = false }: { title: string; detail?: string; items: string[]; warning?: boolean }) {
  const heading = (
    <span className={warning ? 'text-amber-300' : 'text-foreground'}>
      {title}
      {detail && <span className="text-muted-foreground"> · {detail}</span>}
    </span>
  )

  if (items.length === 0) {
    return <p>{heading}</p>
  }

  return (
    <details>
      <summary className="cursor-pointer">{heading}</summary>
      <ul className="mt-1 flex max-h-48 flex-col gap-0.5 overflow-y-auto pl-5 text-muted-foreground">
        {items.map((item, index) => (
          <li key={index} className="list-disc">
            {item}
          </li>
        ))}
      </ul>
    </details>
  )
}

function Message({ tone, children }: { tone: 'error' | 'warning' | 'success' | 'info'; children: ReactNode }) {
  const styles = {
    error: 'border-red-400/30 bg-red-400/10 text-red-300',
    warning: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
    success: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
    info: 'border-primary/30 bg-primary/10 text-primary',
  }
  const Icon = tone === 'success' ? CheckCircle2 : AlertTriangle
  return (
    <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 ${styles[tone]}`}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <p>{children}</p>
    </div>
  )
}
