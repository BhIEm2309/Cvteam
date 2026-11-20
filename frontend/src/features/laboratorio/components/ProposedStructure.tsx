import { useState, type ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowRight, Check, Loader2, PlayCircle, Quote, RefreshCw, X } from 'lucide-react'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { decideRecommendation, runDiagnostic } from '../api'
import type { CurrentOrgChart, CurrentPosition, DiagnosticRun, Finding, FitStatus, Recommendation, Severity } from '../types'
import { OrgChartNode } from './OrgChartNode'
import { PositionTree } from './PositionTree'

// Estructura propuesta con datos reales: el último diagnóstico (reglas explicables, sin IA) sobre la estructura actual.
// Todo es una propuesta: aceptar o rechazar una recomendación registra la decisión de una persona, pero no cambia
// el organigrama ni asigna cargos.

const STATUS_STYLES: Record<FitStatus, { label: string; className: string }> = {
  optimo: { label: 'Óptimo', className: 'text-emerald-300' },
  parcial: { label: 'Ajuste parcial', className: 'text-sky-300' },
  critico: { label: 'Desajuste crítico', className: 'text-red-300' },
  desaprovechado: { label: 'Talento desaprovechado', className: 'text-amber-300' },
  'sin-requisitos': { label: 'Sin requisitos', className: 'text-muted-foreground' },
}

const SEVERITY_STYLES: Record<Severity, { label: string; className: string }> = {
  CRITICAL: { label: 'Crítica', className: 'border-red-400/50 text-red-300' },
  HIGH: { label: 'Alta', className: 'border-red-400/40 text-red-300' },
  MEDIUM: { label: 'Media', className: 'border-amber-400/40 text-amber-300' },
  LOW: { label: 'Baja', className: 'border-border text-muted-foreground' },
}

const GROUPS: { title: string; description: string; match: (finding: Finding) => boolean }[] = [
  {
    title: 'Vacantes y roles faltantes',
    description: 'Cargos con menos personas que su dotación objetivo, y a quién se podría proponer.',
    match: (f) => f.type === 'UNFILLED_POSITION',
  },
  {
    title: 'Personas con brechas en su cargo',
    description: 'Competencias que exige el cargo y la persona no tiene o tiene bajo el nivel pedido.',
    match: (f) => f.type === 'SKILL_GAP',
  },
  {
    title: 'Talento desaprovechado',
    description: 'Personas que superan lo que exige su cargo.',
    match: (f) => f.type === 'UNDERUSED_TALENT',
  },
  {
    title: 'Datos que faltan para evaluar',
    description: 'Sin esta información no se puede calcular el ajuste: no es un desajuste.',
    match: (f) => f.type === 'INSUFFICIENT_DATA',
  },
]

export function ProposedStructure({ current, run }: { current: CurrentOrgChart; run: DiagnosticRun | null }) {
  const queryClient = useQueryClient()
  const runMutation = useMutation({
    mutationFn: runDiagnostic,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['diagnostics', 'latest'] }),
  })

  const runButton = (
    <Button onClick={() => runMutation.mutate()} disabled={runMutation.isPending} variant={run && !run.isOutdated ? 'outline' : 'default'}>
      {runMutation.isPending ? <Loader2 className="animate-spin" /> : run ? <RefreshCw /> : <PlayCircle />}
      {run ? 'Actualizar diagnóstico' : 'Ejecutar diagnóstico'}
    </Button>
  )

  if (run === null) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center text-sm text-muted-foreground">
          <p className="max-w-xl">
            Todavía no hay un diagnóstico. Se calcula con reglas explicables (sin IA) a partir del organigrama, los
            perfiles de cargo y las competencias <strong className="text-foreground">confirmadas</strong> de cada persona.
          </p>
          {runButton}
          {runMutation.error && <p className="text-destructive">{runMutation.error.message}</p>}
        </CardContent>
      </Card>
    )
  }

  const [year, month, day] = run.asOfDate.split('-')
  const s = run.summary

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="text-sm text-muted-foreground">
          <p>
            Diagnóstico del {day}-{month}-{year} · reglas <code className="text-xs">{run.rulesetVersion}</code>
          </p>
          <p>
            {s.vacancies} vacante(s) · {s.byStatus.critico} desajuste(s) crítico(s) · {s.byStatus.parcial} ajuste(s) parcial(es) ·{' '}
            {s.byStatus.desaprovechado} talento(s) desaprovechado(s) · {s.reassignmentProposals} propuesta(s) de reasignación ·{' '}
            {s.peopleWithoutData + s.peopleWithoutPosition} persona(s) sin datos o sin cargo
          </p>
        </div>
        {runButton}
      </div>
      {runMutation.error && <p className="text-sm text-destructive">{runMutation.error.message}</p>}
      {run.isOutdated && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>
            Los datos cambiaron después de este diagnóstico (cargos, perfiles, personas o competencias). Actualízalo para
            ver la propuesta con los datos de hoy.
          </p>
        </div>
      )}

      <Card>
        <CardContent className="py-4">
          {current.positions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Todavía no hay cargos.</p>
          ) : (
            <PositionTree positions={current.positions} renderBox={(position) => <ProposedBox position={position} run={run} />} />
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        La IA no decide nada aquí: son reglas fijas sobre datos confirmados por personas. Aceptar o rechazar una
        recomendación solo registra la decisión; no cambia el organigrama.
      </p>

      {GROUPS.map((group) => {
        const findings = run.findings.filter(group.match)
        if (findings.length === 0) return null
        return (
          <section key={group.title} className="flex flex-col gap-2">
            <div>
              <h3 className="text-base font-semibold">
                {group.title} <span className="text-muted-foreground">({findings.length})</span>
              </h3>
              <p className="text-sm text-muted-foreground">{group.description}</p>
            </div>
            {findings.map((finding) => (
              <FindingCard key={finding.id} finding={finding} />
            ))}
          </section>
        )
      })}
    </div>
  )
}

// Caja de un cargo en la estructura propuesta: personas de hoy con su estado y las personas propuestas.
function ProposedBox({ position, run }: { position: CurrentPosition; run: DiagnosticRun }) {
  const vacancy = run.findings.find((f) => f.type === 'UNFILLED_POSITION' && f.positionId === position.id)
  const proposals = (vacancy?.recommendations ?? []).filter((r) => r.metadata.kind === 'reasignar' && r.status !== 'REJECTED')
  const statusOf = (employeeId: string): FitStatus | 'sin-datos' | null => {
    const finding = run.findings.find((f) => f.employeeId === employeeId && f.positionId === position.id)
    if (!finding) return null
    if (finding.type === 'INSUFFICIENT_DATA') return 'sin-datos'
    return finding.metrics.status ?? null
  }
  // Personas de este cargo propuestas para otro (con vacantes).
  const leaving = (employeeId: string) =>
    run.findings
      .flatMap((f) => f.recommendations)
      .find((r) => r.metadata.kind === 'reasignar' && r.metadata.employeeId === employeeId && r.metadata.toPositionId !== position.id && r.status !== 'REJECTED')

  const kind = proposals.length > 0 ? 'proposed' : position.currentHeadcount === 0 ? 'missing' : 'existing'
  const note =
    position.vacancies > 0
      ? `${position.vacancies} ${position.vacancies === 1 ? 'vacante' : 'vacantes'}${proposals.length > 0 ? ' · con propuesta' : ' · sin candidato'}`
      : `${position.currentHeadcount} ${position.currentHeadcount === 1 ? 'persona' : 'personas'}`

  return (
    <OrgChartNode node={{ title: position.title, note, kind }}>
      <p className="mt-1 text-[11px] text-muted-foreground">{position.departmentName}</p>
      <ul className="mt-1 flex flex-col gap-0.5 text-[11px]">
        {position.people.slice(0, 6).map((person) => {
          const status = statusOf(person.employeeId)
          const move = leaving(person.employeeId)
          return (
            <li key={person.employeeId} className="truncate text-foreground/80" title={person.fullName}>
              {person.fullName}
              {status === 'sin-datos' ? (
                <span className="text-muted-foreground"> · sin datos</span>
              ) : status ? (
                <span className={STATUS_STYLES[status].className}> · {STATUS_STYLES[status].label}</span>
              ) : null}
              {move && <span className="text-emerald-300"> → {move.metadata.toPositionTitle}</span>}
            </li>
          )
        })}
        {position.people.length > 6 && <li className="text-muted-foreground">+{position.people.length - 6} más</li>}
        {proposals.map((proposal) => (
          <li key={proposal.id} className="truncate text-emerald-300" title={proposal.title}>
            <ArrowRight className="inline size-3" /> {proposal.metadata.employeeName} ({proposal.metadata.fitPercent} %)
            {proposal.status === 'ACCEPTED' ? ' · aceptada' : ' · propuesta'}
          </li>
        ))}
      </ul>
    </OrgChartNode>
  )
}

function FindingCard({ finding }: { finding: Finding }) {
  const severity = SEVERITY_STYLES[finding.severity]
  const m = finding.metrics
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 py-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{finding.title}</span>
          <Badge variant="outline" className={severity.className}>
            Prioridad {severity.label.toLowerCase()}
          </Badge>
          {m.status && m.fitPercent !== undefined && m.fitPercent !== null && (
            <span className={`text-xs ${STATUS_STYLES[m.status].className}`}>Ajuste {m.fitPercent} %</span>
          )}
        </div>
        <p className="text-muted-foreground">{finding.description}</p>

        {/* Evidencia: qué falta, qué está bajo el nivel, qué sobra. */}
        <EvidenceList title="Le faltan" items={(m.missing ?? []).map((r) => `${r.name}${r.isMandatory ? ' (obligatoria)' : ''}${r.requiredLevel ? ` · nivel ${r.requiredLevel}` : ''}`)} />
        <EvidenceList
          title="Bajo el nivel pedido"
          items={(m.belowLevel ?? []).map((r) => `${r.name}: ${r.currentLevel ?? 'sin nivel'} de ${r.requiredLevel}`)}
        />
        <EvidenceList title="Sobre el nivel pedido" items={(m.aboveLevel ?? []).map((r) => `${r.name}: ${r.currentLevel} (pide ${r.requiredLevel})`)} />
        {finding.type === 'UNDERUSED_TALENT' && (
          <EvidenceList title="Competencias que su cargo no pide" items={(m.notRequired ?? []).map((r) => r.name)} />
        )}
        <EvidenceList
          title="Mejores ajustes"
          items={(m.bestFits ?? []).map((b) => `${b.title}: ${b.fitPercent ?? '—'} % (${STATUS_STYLES[b.status].label.toLowerCase()})`)}
        />
        {finding.evidence.length > 0 && (
          <details>
            <summary className="cursor-pointer text-xs text-muted-foreground">Fragmentos del CV que lo respaldan ({finding.evidence.length})</summary>
            <ul className="mt-1 flex flex-col gap-1">
              {finding.evidence.map((evidence) => (
                <li key={evidence.id} className="flex gap-2 text-xs text-muted-foreground">
                  <Quote className="mt-0.5 size-3 shrink-0 text-primary" />
                  <span className="italic">{evidence.excerpt}</span>
                </li>
              ))}
            </ul>
          </details>
        )}

        {finding.recommendations.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-border pt-2">
            {finding.recommendations.map((recommendation) => (
              <RecommendationRow key={recommendation.id} recommendation={recommendation} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function EvidenceList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <p className="text-xs text-muted-foreground">
      <span className="text-foreground">{title}:</span> {items.join(' · ')}
    </p>
  )
}

function RecommendationRow({ recommendation }: { recommendation: Recommendation }) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const mutation = useMutation({
    mutationFn: (status: 'ACCEPTED' | 'REJECTED') => decideRecommendation(recommendation.id, status),
    onSuccess: () => {
      setError(null)
      queryClient.invalidateQueries({ queryKey: ['diagnostics', 'latest'] })
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'No se pudo guardar la decisión.'),
  })

  let state: ReactNode = null
  if (recommendation.status === 'ACCEPTED') state = <Badge variant="outline" className="border-emerald-400/40 text-emerald-300">Aceptada</Badge>
  if (recommendation.status === 'REJECTED') state = <Badge variant="outline" className="border-border text-muted-foreground">Rechazada</Badge>

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{recommendation.title}</span>
        {state ?? <Badge variant="outline" className="border-primary/40 text-primary">Propuesta</Badge>}
      </div>
      <p className="text-xs text-muted-foreground">{recommendation.description}</p>
      {recommendation.status === 'PROPOSED' && (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={mutation.isPending} onClick={() => mutation.mutate('ACCEPTED')}>
            <Check /> Aceptar
          </Button>
          <Button size="sm" variant="outline" disabled={mutation.isPending} onClick={() => mutation.mutate('REJECTED')}>
            <X /> Rechazar
          </Button>
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
