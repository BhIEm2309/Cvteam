import type { NodeKind, OrgNode } from '../mock'

// Clases de color de cada tipo de caja: borde, fondo y color de la nota.
const NODE_STYLES: Record<NodeKind, { box: string; note: string }> = {
  existing: {
    box: 'border-sky-400/70 bg-[#0d1f3a]',
    note: 'text-sky-300',
  },
  overloaded: {
    box: 'border-red-400/80 bg-red-950/40 shadow-[0_0_14px_rgba(248,113,113,0.25)]',
    note: 'text-red-300',
  },
  missing: {
    box: 'border-dashed border-slate-500/70 bg-transparent',
    note: 'text-slate-500',
  },
  proposed: {
    box: 'border-emerald-400/80 bg-emerald-950/30 shadow-[0_0_14px_rgba(52,211,153,0.2)]',
    note: 'text-emerald-300',
  },
  consequence: {
    box: 'border-red-400/80 bg-red-950/40',
    note: 'text-red-300',
  },
}

interface OrgChartNodeProps {
  node: OrgNode
}

// Una caja del organigrama.
export function OrgChartNode({ node }: OrgChartNodeProps) {
  const styles = NODE_STYLES[node.kind]
  const titleColor = node.kind === 'missing' ? 'text-slate-400' : 'text-foreground'

  return (
    <div className={`rounded-lg border-2 px-3 py-2.5 ${styles.box}`}>
      <p className={`text-sm font-semibold ${titleColor}`}>{node.title}</p>
      <p className={`text-xs ${styles.note}`}>{node.kind === 'missing' ? `— ${node.note} —` : node.note}</p>
    </div>
  )
}
