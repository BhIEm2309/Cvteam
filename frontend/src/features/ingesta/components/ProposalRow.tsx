import { Check, Quote, X } from 'lucide-react'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { SKILL_CATEGORY_LABELS } from '../constants'
import type { Proposal, SkillCategory } from '../review'

// Lo que decidió quien revisa sobre una propuesta (todavía sin guardar).
export interface ProposalDraft {
  action: 'confirm' | 'dismiss' | null
  name: string
  category: SkillCategory
  level: number | null
}

interface ProposalRowProps {
  proposal: Proposal
  draft: ProposalDraft
  disabled: boolean
  onChange: (changes: Partial<ProposalDraft>) => void
}

const NO_LEVEL = 'sin-nivel'

// Una competencia propuesta: fragmento del CV que la respalda, correcciones y decisión.
export function ProposalRow({ proposal, draft, disabled, onChange }: ProposalRowProps) {
  if (proposal.reviewStatus !== 'PENDING') {
    return (
      <div className="flex flex-col gap-1 rounded-lg border border-border bg-card/40 p-3 opacity-80">
        <div className="flex items-center gap-2">
          <span className="font-medium">{proposal.name}</span>
          {proposal.reviewStatus === 'CONFIRMED' ? (
            <Badge variant="outline" className="border-emerald-400/40 text-emerald-300">Confirmada</Badge>
          ) : (
            <Badge variant="outline" className="border-border text-muted-foreground">Descartada</Badge>
          )}
        </div>
        <Excerpt text={proposal.excerpt} />
      </div>
    )
  }

  const borderClass =
    draft.action === 'confirm' ? 'border-emerald-400/50' : draft.action === 'dismiss' ? 'border-red-400/40 opacity-70' : 'border-border'

  return (
    <div className={`flex flex-col gap-3 rounded-lg border bg-card/60 p-3 ${borderClass}`}>
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <Input
          aria-label="Nombre de la competencia"
          value={draft.name}
          maxLength={160}
          disabled={disabled || draft.action === 'dismiss'}
          onChange={(event) => onChange({ name: event.target.value })}
          className="md:flex-1"
        />
        <div className="flex gap-2">
          <Select
            value={draft.category}
            disabled={disabled || draft.action === 'dismiss'}
            onValueChange={(value) => onChange({ category: value as SkillCategory })}
          >
            <SelectTrigger className="w-32" aria-label="Categoría">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TECHNICAL">{SKILL_CATEGORY_LABELS.TECHNICAL}</SelectItem>
              <SelectItem value="BEHAVIORAL">{SKILL_CATEGORY_LABELS.BEHAVIORAL}</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={draft.level === null ? NO_LEVEL : String(draft.level)}
            disabled={disabled || draft.action === 'dismiss'}
            onValueChange={(value) => onChange({ level: value === NO_LEVEL ? null : Number(value) })}
          >
            <SelectTrigger className="w-28" aria-label="Nivel">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_LEVEL}>Sin nivel</SelectItem>
              {[1, 2, 3, 4, 5].map((level) => (
                <SelectItem key={level} value={String(level)}>
                  Nivel {level}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Excerpt text={proposal.excerpt} />

      {draft.action !== 'dismiss' && (
        <CatalogHint proposal={proposal} draft={draft} disabled={disabled} onChange={onChange} />
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={draft.action === 'confirm' ? 'default' : 'outline'}
          disabled={disabled || draft.name.trim() === ''}
          onClick={() => onChange({ action: draft.action === 'confirm' ? null : 'confirm' })}
        >
          <Check /> Confirmar
        </Button>
        <Button
          size="sm"
          variant={draft.action === 'dismiss' ? 'destructive' : 'outline'}
          disabled={disabled}
          onClick={() => onChange({ action: draft.action === 'dismiss' ? null : 'dismiss' })}
        >
          <X /> Descartar
        </Button>
      </div>
    </div>
  )
}

// Igual que normalizeKey de la API: sin mayúsculas, tildes ni espacios repetidos.
function sameName(a: string, b: string): boolean {
  const key = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
  return key(a) === key(b)
}

// Relación con el catálogo. El ajuste al cargo cruza por nombre exacto: si la competencia del CV es la misma que una
// del catálogo con otro nombre, quien revisa puede usar ese nombre. Es una sugerencia; nunca se cambia sola.
function CatalogHint({ proposal, draft, disabled, onChange }: ProposalRowProps) {
  const match = proposal.catalogMatch
  if (match === null) return null

  const chosen = [match.exact, ...match.similar].find((skill) => skill !== null && sameName(skill.name, draft.name))
  if (chosen) {
    return <p className="text-xs text-emerald-300">Ya está en el catálogo como «{chosen.name}»: cuenta para los cargos que la exigen.</p>
  }
  if (match.similar.length === 0) {
    return null
  }
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span>Parecida a una competencia del catálogo:</span>
      {match.similar.map((skill) => (
        <Button
          key={skill.id}
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          disabled={disabled}
          onClick={() => onChange({ name: skill.name, category: skill.category })}
        >
          Usar «{skill.name}»
        </Button>
      ))}
      <span>Si no es la misma, deja el nombre como está.</span>
    </div>
  )
}

// Fragmento del CV que respalda la competencia (copiado tal cual por la IA y comprobado por la API).
function Excerpt({ text }: { text: string }) {
  return (
    <p className="flex gap-2 text-sm text-muted-foreground">
      <Quote className="mt-0.5 size-3.5 shrink-0 text-primary" />
      <span className="italic">{text}</span>
    </p>
  )
}
