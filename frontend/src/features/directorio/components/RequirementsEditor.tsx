import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Loader2, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { LoadState } from '@/shared/components/LoadState'
import { getPositionSkills, getSkillCatalog, savePositionSkills, type RequirementBody } from '../api'
import { SKILL_CATEGORY_LABELS } from '../constants'
import type { PositionSkill, SkillCategory, SkillOption } from '../types'

interface RequirementsEditorProps {
  position: { id: string; title: string }
  onDone: () => void
}

// Una fila del editor: competencia del catálogo (skillId) o nueva (name + category).
interface Row {
  key: string
  skillId: string | null
  name: string
  category: SkillCategory
  requiredLevel: number | null
  isMandatory: boolean
  weight: string
}

const NO_LEVEL = 'sin-nivel'
const NEW_SKILL = '__nueva__'

function toRow(item: PositionSkill): Row {
  return {
    key: item.skillId,
    skillId: item.skillId,
    name: item.name,
    category: item.category,
    requiredLevel: item.requiredLevel,
    isMandatory: item.isMandatory,
    weight: String(item.weight),
  }
}

// Carga los requisitos actuales del cargo y el catálogo, y muestra el formulario.
export function RequirementsEditor({ position, onDone }: RequirementsEditorProps) {
  const requirementsQuery = useQuery({
    queryKey: ['position-skills', position.id],
    queryFn: () => getPositionSkills(position.id),
    refetchOnWindowFocus: false,
  })
  const catalogQuery = useQuery({ queryKey: ['skills'], queryFn: getSkillCatalog, refetchOnWindowFocus: false })

  if (!requirementsQuery.data || !catalogQuery.data) {
    return (
      <LoadState
        isPending={requirementsQuery.isPending || catalogQuery.isPending}
        error={requirementsQuery.error ?? catalogQuery.error}
      />
    )
  }
  return <EditorForm position={position} initial={requirementsQuery.data} catalog={catalogQuery.data} onDone={onDone} />
}

interface EditorFormProps {
  position: { id: string; title: string }
  initial: PositionSkill[]
  catalog: SkillOption[]
  onDone: () => void
}

function EditorForm({ position, initial, catalog, onDone }: EditorFormProps) {
  const queryClient = useQueryClient()
  const [rows, setRows] = useState<Row[]>(() => initial.map(toRow))
  const [toAdd, setToAdd] = useState('')
  const [newName, setNewName] = useState('')
  const [newCategory, setNewCategory] = useState<SkillCategory>('TECHNICAL')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const available = catalog.filter((skill) => !rows.some((row) => row.skillId === skill.id))
  const invalidWeight = rows.some((row) => !isValidWeight(row.weight))

  function update(key: string, changes: Partial<Row>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...changes } : row)))
  }

  function addRow() {
    if (toAdd === NEW_SKILL) {
      const name = newName.trim().replace(/\s+/g, ' ')
      if (name === '') return
      setRows((current) => [
        ...current,
        { key: `nueva-${crypto.randomUUID()}`, skillId: null, name, category: newCategory, requiredLevel: 3, isMandatory: true, weight: '1' },
      ])
      setNewName('')
    } else {
      const skill = catalog.find((option) => option.id === toAdd)
      if (!skill) return
      setRows((current) => [
        ...current,
        { key: skill.id, skillId: skill.id, name: skill.name, category: skill.category, requiredLevel: 3, isMandatory: true, weight: '1' },
      ])
    }
    setToAdd('')
  }

  async function save() {
    const body: RequirementBody[] = rows.map((row) => {
      const common = { requiredLevel: row.requiredLevel, isMandatory: row.isMandatory, weight: Number(row.weight.replace(',', '.')) }
      return row.skillId !== null ? { skillId: row.skillId, ...common } : { name: row.name, category: row.category, ...common }
    })
    setSaving(true)
    setError(null)
    try {
      await savePositionSkills(position.id, body)
      // El ajuste de todas las personas del cargo cambia: se vuelve a pedir el directorio.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['collaborators'] }),
        queryClient.invalidateQueries({ queryKey: ['position-skills', position.id] }),
        queryClient.invalidateQueries({ queryKey: ['skills'] }),
      ])
      onDone()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudieron guardar los requisitos.')
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-start gap-1.5 rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
        Estos requisitos son del cargo "{position.title}": cambian el ajuste de todas las personas con ese cargo.
      </p>

      {rows.length === 0 && <p className="text-sm text-muted-foreground">Sin requisitos. Agrega competencias abajo.</p>}

      {rows.map((row) => (
        <div key={row.key} className="flex flex-col gap-2 rounded-md border border-border p-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-foreground">
              {row.name}
              {row.skillId === null && <span className="ml-1 text-xs text-primary">(nueva)</span>}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label={`Quitar ${row.name}`}
              disabled={saving}
              onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}
            >
              <Trash2 />
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={row.requiredLevel === null ? NO_LEVEL : String(row.requiredLevel)}
              disabled={saving}
              onValueChange={(value) => update(row.key, { requiredLevel: value === NO_LEVEL ? null : Number(value) })}
            >
              <SelectTrigger className="h-8 w-32" aria-label={`Nivel requerido de ${row.name}`}>
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
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                className="size-3.5 accent-primary"
                checked={row.isMandatory}
                disabled={saving}
                onChange={(event) => update(row.key, { isMandatory: event.target.checked })}
              />
              Obligatoria
            </label>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              Peso
              <Input
                className={`h-8 w-16 ${isValidWeight(row.weight) ? '' : 'border-red-400'}`}
                inputMode="decimal"
                value={row.weight}
                disabled={saving}
                aria-label={`Peso de ${row.name}`}
                onChange={(event) => update(row.key, { weight: event.target.value })}
              />
            </label>
          </div>
        </div>
      ))}

      {/* Agregar un requisito: del catálogo o una competencia nueva */}
      <div className="flex flex-col gap-2 rounded-md border border-dashed border-border p-2">
        <Select value={toAdd} onValueChange={setToAdd} disabled={saving}>
          <SelectTrigger className="h-8 w-full" aria-label="Competencia a agregar">
            <SelectValue placeholder="Agregar competencia…" />
          </SelectTrigger>
          <SelectContent>
            {available.map((skill) => (
              <SelectItem key={skill.id} value={skill.id}>
                {skill.name} · {SKILL_CATEGORY_LABELS[skill.category]} ({skill.employeeCount} personas)
              </SelectItem>
            ))}
            <SelectItem value={NEW_SKILL}>+ Competencia nueva</SelectItem>
          </SelectContent>
        </Select>
        {toAdd === NEW_SKILL && (
          <div className="flex gap-2">
            <Input
              className="h-8"
              placeholder="Nombre de la competencia"
              maxLength={160}
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
            />
            <Select value={newCategory} onValueChange={(value) => setNewCategory(value as SkillCategory)}>
              <SelectTrigger className="h-8 w-28" aria-label="Categoría">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TECHNICAL">{SKILL_CATEGORY_LABELS.TECHNICAL}</SelectItem>
                <SelectItem value="BEHAVIORAL">{SKILL_CATEGORY_LABELS.BEHAVIORAL}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          disabled={saving || toAdd === '' || (toAdd === NEW_SKILL && newName.trim() === '')}
          onClick={addRow}
        >
          <Plus /> Agregar
        </Button>
      </div>

      {invalidWeight && <p className="text-xs text-red-300">El peso debe ser un número mayor que 0 y hasta 100.</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" disabled={saving} onClick={onDone}>
          Cancelar
        </Button>
        <Button size="sm" disabled={saving || invalidWeight} onClick={save}>
          {saving && <Loader2 className="animate-spin" />} Guardar requisitos
        </Button>
      </div>
    </div>
  )
}

// Mismo criterio que la API: mayor que 0 y hasta 100, con 2 decimales como máximo (se acepta coma).
function isValidWeight(text: string): boolean {
  const value = Number(text.replace(',', '.'))
  return text.trim() !== '' && Number.isFinite(value) && value > 0 && value <= 100 && Math.abs(Math.round(value * 100) - value * 100) < 1e-9
}
