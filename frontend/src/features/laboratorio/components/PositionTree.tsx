import { useLayoutEffect, useRef } from 'react'
import type { CurrentPosition } from '../types'
import { OrgChartNode } from './OrgChartNode'

// Cuántos nombres se muestran por cargo antes de resumir con "+N más".
const MAX_NAMES = 5

interface PositionTreeProps {
  positions: CurrentPosition[]
}

// Organigrama actual: árbol de cargos según su cargo superior (parentPositionId), con cualquier cantidad de niveles.
// Puede haber varias raíces (por ejemplo, si el superior de un cargo está archivado): se muestran lado a lado.
// Si el árbol es más ancho que la pantalla, se desplaza horizontalmente y parte centrado (donde está la raíz).
export function PositionTree({ positions }: PositionTreeProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const element = scrollRef.current
    if (element) {
      element.scrollLeft = (element.scrollWidth - element.clientWidth) / 2
    }
  }, [positions])

  const childrenOf = new Map<string | null, CurrentPosition[]>()
  for (const position of positions) {
    childrenOf.set(position.parentPositionId, [...(childrenOf.get(position.parentPositionId) ?? []), position])
  }

  return (
    <div ref={scrollRef} className="overflow-x-auto pb-2">
      <div className="mx-auto w-max">
        <Branches nodes={childrenOf.get(null) ?? []} childrenOf={childrenOf} isRoot />
      </div>
    </div>
  )
}

interface BranchesProps {
  nodes: CurrentPosition[]
  childrenOf: Map<string | null, CurrentPosition[]>
  // Las raíces no tienen cargo superior: van sin líneas (varias raíces no comparten jefatura).
  isRoot?: boolean
}

// Una fila de cargos hermanos, unidos por una línea horizontal, cada uno con su propio subárbol debajo.
function Branches({ nodes, childrenOf, isRoot = false }: BranchesProps) {
  return (
    <div className={isRoot ? 'flex gap-8' : 'flex'}>
      {nodes.map((node, index) => (
        <div key={node.id} className={`relative flex flex-col items-center px-2 ${isRoot ? '' : 'pt-5'}`}>
          {/* Línea horizontal hacia los hermanos: de la mitad de la primera caja a la mitad de la última. */}
          {!isRoot && nodes.length > 1 && (
            <div
              className="absolute top-0 h-px bg-slate-500"
              style={{ left: index === 0 ? '50%' : 0, right: index === nodes.length - 1 ? '50%' : 0 }}
            />
          )}
          {/* Línea vertical desde la fila superior hasta la caja. */}
          {!isRoot && <div className="absolute top-0 left-1/2 h-5 w-px bg-slate-500" />}
          <div className="w-52">
            <PositionBox position={node} />
          </div>
          {(childrenOf.get(node.id) ?? []).length > 0 && (
            <>
              <div className="h-5 w-px bg-slate-500" />
              <Branches nodes={childrenOf.get(node.id) ?? []} childrenOf={childrenOf} />
            </>
          )}
        </div>
      ))}
    </div>
  )
}

// Caja de un cargo: área, personas asignadas hoy y vacantes. Sin personas, la caja va punteada.
function PositionBox({ position }: { position: CurrentPosition }) {
  const hidden = position.people.length - MAX_NAMES

  return (
    <OrgChartNode
      node={{
        title: position.title,
        note: headcountNote(position),
        kind: position.currentHeadcount === 0 ? 'missing' : 'existing',
      }}
    >
      <p className="mt-1 text-[11px] text-muted-foreground">{position.departmentName}</p>
      {position.people.length > 0 && (
        <ul className="mt-1 text-[11px] text-foreground/80">
          {position.people.slice(0, MAX_NAMES).map((person) => (
            <li key={person.employeeId} className="truncate">
              {person.fullName}
              {person.allocationPercent < 100 && <span className="text-muted-foreground"> · {person.allocationPercent} %</span>}
            </li>
          ))}
          {hidden > 0 && <li className="text-muted-foreground">+{hidden} más</li>}
        </ul>
      )}
    </OrgChartNode>
  )
}

// "2 personas · dotación 3 · 1 vacante", "sin personas · dotación 2 · 2 vacantes", "1 persona · dotación 1".
function headcountNote(position: CurrentPosition): string {
  const people =
    position.currentHeadcount === 0
      ? 'sin personas'
      : `${position.currentHeadcount} ${position.currentHeadcount === 1 ? 'persona' : 'personas'}`
  const base = `${people} · dotación ${position.targetHeadcount}`
  if (position.vacancies > 0) {
    return `${base} · ${position.vacancies} ${position.vacancies === 1 ? 'vacante' : 'vacantes'}`
  }
  if (position.overstaffing > 0) {
    return `${base} · ${position.overstaffing} sobre la dotación`
  }
  return base
}
