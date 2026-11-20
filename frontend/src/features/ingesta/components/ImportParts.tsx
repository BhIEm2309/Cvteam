import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'

// Piezas comunes de las tarjetas de importación por CSV (organigrama y perfiles de cargo).

export interface ImportIssue {
  lines: number[]
  message: string
}

export function ImportIssueList({ issues }: { issues: ImportIssue[] }) {
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

export function ImportSummaryList({ title, detail, items, warning = false }: { title: string; detail?: string; items: string[]; warning?: boolean }) {
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

export function ImportMessage({ tone, children }: { tone: 'error' | 'warning' | 'success' | 'info'; children: ReactNode }) {
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
