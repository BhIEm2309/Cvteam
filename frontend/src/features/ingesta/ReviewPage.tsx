import { useMemo, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeft, CheckCircle2, ExternalLink, Info, Loader2 } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { LoadState } from '@/shared/components/LoadState'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { getSourceStatus, useReportSourceStatus } from '@/shared/lib/data-source'
import { ProposalRow, type ProposalDraft } from './components/ProposalRow'
import { SKILL_CATEGORY_LABELS } from './constants'
import {
  getDocumentExtraction,
  getEmployeeOptions,
  REVIEW_AVAILABLE,
  saveReview,
  type DocumentExtraction,
  type Proposal,
  type ReviewBody,
  type ReviewResult,
  type SkillCategory,
} from './review'

// Valor del selector de persona que significa "crear una persona nueva".
const NEW_EMPLOYEE = '__nueva__'

// Revisión humana de las competencias que propuso la IA para un CV. Nada cambia hasta "Guardar revisión".
export function ReviewPage() {
  const { documentId = '' } = useParams()
  const pagePath = `/ingesta/revision/${documentId}`

  const extractionQuery = useQuery({
    queryKey: ['extraction', documentId],
    queryFn: () => getDocumentExtraction(documentId),
    enabled: REVIEW_AVAILABLE,
    // No se recarga al volver a la pestaña: reiniciaría las decisiones que todavía no se guardan.
    refetchOnWindowFocus: false,
  })
  // Resultado del último guardado. El contador reinicia el formulario con las propuestas actualizadas.
  const [result, setResult] = useState<ReviewResult | null>(null)
  const [saveCount, setSaveCount] = useState(0)
  const employeesQuery = useQuery({ queryKey: ['employees'], queryFn: getEmployeeOptions, enabled: REVIEW_AVAILABLE })

  // La barra superior muestra "Conectado" o el error de esta página (no hay datos de ejemplo aquí).
  useReportSourceStatus(
    pagePath,
    getSourceStatus({
      isPending: extractionQuery.isPending,
      error: extractionQuery.error,
      data: extractionQuery.data ? { data: extractionQuery.data, source: 'api' } : undefined,
    }),
  )

  return (
    <div>
      <PageHeader
        title="Revisión de competencias"
        description="Confirma o descarta lo que propuso la IA. Solo lo confirmado queda registrado para la persona."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/ingesta">
              <ArrowLeft /> Volver a Ingesta
            </Link>
          </Button>
        }
      />

      {!REVIEW_AVAILABLE ? (
        <Notice tone="info">
          La revisión necesita la API: en modo de ejemplo (VITE_DATA_MODE=mock) no se simula, porque confirmar crea
          competencias y datos de personas.
        </Notice>
      ) : extractionQuery.data ? (
        <div className="flex flex-col gap-6">
          {result && <ResultSummary result={result} />}
          {/* key: al cambiar de documento o después de guardar, se reinician las decisiones. */}
          <ReviewForm
            key={`${documentId}-${saveCount}`}
            extraction={extractionQuery.data}
            employees={employeesQuery.data ?? []}
            employeesError={employeesQuery.error}
            onSaved={(saved) => {
              setResult(saved)
              setSaveCount((count) => count + 1)
            }}
          />
        </div>
      ) : (
        <LoadState isPending={extractionQuery.isPending} error={extractionQuery.error} />
      )}
    </div>
  )
}

interface ReviewFormProps {
  extraction: DocumentExtraction
  employees: Awaited<ReturnType<typeof getEmployeeOptions>>
  employeesError: Error | null
  onSaved: (result: ReviewResult) => void
}

function ReviewForm({ extraction, employees, employeesError, onSaved }: ReviewFormProps) {
  const queryClient = useQueryClient()
  const candidateName = extraction.run?.candidateName ?? ''

  const [drafts, setDrafts] = useState<Record<string, ProposalDraft>>(() =>
    Object.fromEntries(
      extraction.proposals.map((proposal) => [
        proposal.id,
        { action: null, name: proposal.name, category: proposal.category, level: proposal.level },
      ]),
    ),
  )
  const [selectedEmployee, setSelectedEmployee] = useState<string>(extraction.suggestedEmployeeId ?? '')
  const [newEmployeeName, setNewEmployeeName] = useState(candidateName)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const pending = extraction.proposals.filter((proposal) => proposal.reviewStatus === 'PENDING')
  const decided = pending.filter((proposal) => drafts[proposal.id]?.action !== null)
  const toConfirm = decided.filter((proposal) => drafts[proposal.id].action === 'confirm').length
  const toDismiss = decided.length - toConfirm

  const linkedEmployee = extraction.employee
  const personChosen =
    linkedEmployee !== null ||
    (selectedEmployee === NEW_EMPLOYEE ? newEmployeeName.trim() !== '' : selectedEmployee !== '')
  const canSave = !saving && decided.length > 0 && (toConfirm === 0 || personChosen)

  const groups = useMemo(() => groupByCategory(extraction.proposals), [extraction.proposals])

  function updateDraft(proposalId: string, changes: Partial<ProposalDraft>) {
    setDrafts((current) => ({ ...current, [proposalId]: { ...current[proposalId], ...changes } }))
  }

  function setAllPending(action: ProposalDraft['action']) {
    setDrafts((current) => {
      const next = { ...current }
      for (const proposal of pending) {
        // No se confirma una competencia a la que le borraron el nombre.
        const blocked = action === 'confirm' && next[proposal.id].name.trim() === ''
        next[proposal.id] = { ...next[proposal.id], action: blocked ? next[proposal.id].action : action }
      }
      return next
    })
  }

  async function handleSave() {
    const body: ReviewBody = {
      decisions: decided.map((proposal) => {
        const draft = drafts[proposal.id]
        if (draft.action === 'dismiss') {
          return { proposalId: proposal.id, action: 'dismiss' as const }
        }
        // Solo se envían las correcciones (lo que cambió respecto de la propuesta).
        return {
          proposalId: proposal.id,
          action: 'confirm' as const,
          ...(draft.name.trim() !== proposal.name ? { name: draft.name.trim() } : {}),
          ...(draft.category !== proposal.category ? { category: draft.category } : {}),
          ...(draft.level !== proposal.level ? { level: draft.level } : {}),
        }
      }),
    }
    if (toConfirm > 0) {
      if (linkedEmployee !== null) {
        body.employeeId = linkedEmployee.id
      } else if (selectedEmployee === NEW_EMPLOYEE) {
        body.newEmployeeName = newEmployeeName.trim()
      } else {
        body.employeeId = selectedEmployee
      }
    }

    setSaving(true)
    setSaveError(null)
    try {
      const saved = await saveReview(extraction.documentId, body)
      // La lista de Ingesta muestra cuántas competencias quedan por revisar; la de personas puede tener una nueva.
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      queryClient.setQueryData(['extraction', extraction.documentId], saved.extraction)
      // Reinicia el formulario (cambia su key) con las propuestas ya revisadas.
      onSaved(saved)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'No se pudo guardar la revisión.')
      setSaving(false)
    }
  }

  if (extraction.documentType !== 'CV') {
    return <Notice tone="info">Por ahora solo se revisan CVs.</Notice>
  }
  if (extraction.status !== 'COMPLETED') {
    return (
      <Notice tone={extraction.status === 'FAILED' ? 'error' : 'info'}>
        {extraction.status === 'FAILED'
          ? `El análisis de este CV falló: ${extraction.run?.errorMessage ?? 'error desconocido'}. Pídelo de nuevo desde Ingesta.`
          : 'Este CV todavía no tiene un análisis terminado. Vuelve cuando aparezca como "Analizado" en Ingesta.'}
      </Notice>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">{extraction.documentTitle}</CardTitle>
            <p className="text-sm text-muted-foreground">
              Nombre en el CV: <strong className="text-foreground">{candidateName || 'no detectado'}</strong>
              {extraction.run?.model && <> · Analizado con {extraction.run.model}</>}
            </p>
            {extraction.run?.model && extraction.run.requestedModel && extraction.run.requestedModel !== extraction.run.model && (
              // El modelo configurado rechazó la solicitud y la API la respondió con otro (respaldo automático).
              <p className="text-xs text-amber-300">
                Se pidió {extraction.run.requestedModel}, pero respondió {extraction.run.model} por el respaldo automático
                de la API.
              </p>
            )}
          </div>
          <Button asChild variant="outline" size="sm">
            <a href={`/api/documents/${extraction.documentId}/file`} target="_blank" rel="noreferrer">
              <ExternalLink /> Ver CV
            </a>
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm font-medium">¿De quién es este CV?</p>
          {linkedEmployee !== null ? (
            <p className="text-sm text-muted-foreground">
              Vinculado a <strong className="text-foreground">{linkedEmployee.fullName}</strong>. Las competencias
              confirmadas se registran a esta persona.
            </p>
          ) : (
            <div className="flex flex-col gap-2 md:flex-row">
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger className="w-full md:w-80" aria-label="Persona">
                  <SelectValue placeholder="Elige una persona" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.fullName}
                      {employee.currentPositions[0] && ` · ${employee.currentPositions[0].positionTitle}`}
                      {employee.id === extraction.suggestedEmployeeId && ' (sugerida)'}
                    </SelectItem>
                  ))}
                  <SelectItem value={NEW_EMPLOYEE}>+ Crear persona nueva</SelectItem>
                </SelectContent>
              </Select>
              {selectedEmployee === NEW_EMPLOYEE && (
                <Input
                  aria-label="Nombre de la persona nueva"
                  value={newEmployeeName}
                  maxLength={200}
                  placeholder="Nombre completo"
                  onChange={(event) => setNewEmployeeName(event.target.value)}
                  className="md:w-72"
                />
              )}
            </div>
          )}
          {employeesError && <p className="text-sm text-destructive">{employeesError.message}</p>}
          {selectedEmployee === NEW_EMPLOYEE && (
            <p className="text-xs text-muted-foreground">
              La persona se crea sin cargo al guardar. Su cargo se asigna después (por ejemplo, importando el organigrama).
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle className="text-base">
            Competencias propuestas <span className="text-muted-foreground">({pending.length} por revisar)</span>
          </CardTitle>
          {pending.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={saving} onClick={() => setAllPending('confirm')}>
                Confirmar todas
              </Button>
              <Button size="sm" variant="outline" disabled={saving} onClick={() => setAllPending('dismiss')}>
                Descartar todas
              </Button>
              <Button size="sm" variant="ghost" disabled={saving} onClick={() => setAllPending(null)}>
                Limpiar
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {extraction.proposals.length === 0 && (
            <p className="text-sm text-muted-foreground">La IA no encontró competencias respaldadas en este CV.</p>
          )}
          {groups.map(([category, proposals]) => (
            <section key={category} className="flex flex-col gap-3">
              <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                {SKILL_CATEGORY_LABELS[category]}
              </h2>
              {proposals.map((proposal) => (
                <ProposalRow
                  key={proposal.id}
                  proposal={proposal}
                  draft={drafts[proposal.id]}
                  disabled={saving}
                  onChange={(changes) => updateDraft(proposal.id, changes)}
                />
              ))}
            </section>
          ))}

          {extraction.run && extraction.run.discarded.length > 0 && (
            <details className="text-sm text-muted-foreground">
              <summary className="cursor-pointer">
                {extraction.run.discarded.length} propuesta(s) de la IA descartadas automáticamente
              </summary>
              <ul className="mt-2 list-disc pl-5">
                {extraction.run.discarded.map((item, index) => (
                  <li key={index}>
                    <strong className="text-foreground">{item.name}</strong>: {item.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </CardContent>
      </Card>

      {pending.length > 0 && (
        <div className="sticky bottom-0 flex flex-col gap-2 rounded-lg border border-border bg-background/95 p-4 backdrop-blur md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-muted-foreground">
            {toConfirm} a confirmar · {toDismiss} a descartar · {pending.length - decided.length} sin decidir
            {toConfirm > 0 && !personChosen && (
              <span className="block text-amber-300">Elige a quién pertenece el CV para confirmar competencias.</span>
            )}
          </p>
          <Button disabled={!canSave} onClick={handleSave}>
            {saving && <Loader2 className="animate-spin" />} Guardar revisión
          </Button>
        </div>
      )}
      {saveError && <Notice tone="error">{saveError}</Notice>}
    </div>
  )
}

// Agrupa las propuestas por categoría: primero técnicas, después blandas.
function groupByCategory(proposals: Proposal[]): [SkillCategory, Proposal[]][] {
  const order: SkillCategory[] = ['TECHNICAL', 'BEHAVIORAL']
  return order
    .map((category) => [category, proposals.filter((proposal) => proposal.category === category)] as [SkillCategory, Proposal[]])
    .filter(([, items]) => items.length > 0)
}

function ResultSummary({ result }: { result: ReviewResult }) {
  return (
    <Notice tone="success">
      <strong>Revisión guardada.</strong>
      {result.employee && (
        <> Persona: {result.employee.fullName}{result.employee.created && ' (creada ahora)'}.</>
      )}
      {result.registered.length > 0 && <> Registradas: {result.registered.join(', ')}.</>}
      {result.alreadyRegistered.length > 0 && (
        <> Ya estaban registradas (no se cambiaron): {result.alreadyRegistered.join(', ')}.</>
      )}
      {result.createdSkills.length > 0 && <> Nuevas en el catálogo: {result.createdSkills.join(', ')}.</>}
      {result.dismissed > 0 && <> Descartadas: {result.dismissed}.</>}
    </Notice>
  )
}

function Notice({ tone, children }: { tone: 'info' | 'error' | 'success'; children: ReactNode }) {
  const styles = {
    info: 'border-sky-400/30 bg-sky-400/10 text-sky-200',
    error: 'border-red-400/30 bg-red-400/10 text-red-300',
    success: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
  }[tone]
  const Icon = tone === 'error' ? AlertTriangle : tone === 'success' ? CheckCircle2 : Info
  return (
    <div className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${styles}`}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <p>{children}</p>
    </div>
  )
}
