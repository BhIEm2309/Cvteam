import type { OrgChartData } from '../types'
import { OrgChartNode } from './OrgChartNode'

interface OrgChartProps {
  data: OrgChartData
}

// Cantidad de columnas desde tablet (md) en adelante, según cuántas cajas hay en la fila.
// Se escriben las clases completas para que Tailwind las encuentre al generar el CSS.
const COLUMNS_FROM_TABLET: Record<number, string> = {
  1: 'md:grid-cols-1',
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
  5: 'md:grid-cols-5',
  6: 'md:grid-cols-6',
}

function getColumnsClass(count: number): string {
  return COLUMNS_FROM_TABLET[count] ?? 'md:grid-cols-6'
}

// Organigrama simple hecho con cajas y líneas de CSS.
// En celular las cajas se ordenan en 2 columnas y sin líneas; desde tablet se ve el organigrama completo.
// Más adelante se puede reemplazar por React Flow para permitir mover y editar las cajas.
export function OrgChart({ data }: OrgChartProps) {
  const columns = data.directReports.length

  // La línea horizontal va desde el centro de la primera columna hasta el centro de la última.
  // Con 5 columnas, cada columna mide 20% y su centro está en 10%: la línea empieza en 10% y termina en 90%.
  const lineInset = `${50 / columns}%`

  return (
    <div className="mx-auto flex max-w-4xl flex-col items-center">
      {/* Raíz */}
      <div className="w-56 max-w-full">
        <OrgChartNode node={data.root} />
      </div>

      {/* Línea vertical desde la raíz (solo desde tablet) */}
      <div className="hidden h-6 w-px bg-slate-500 md:block" />

      {/* Fila de cajas conectadas a la raíz */}
      <div className={`relative mt-4 grid w-full grid-cols-2 gap-4 md:mt-0 ${getColumnsClass(columns)}`}>
        <div className="absolute top-0 hidden h-px bg-slate-500 md:block" style={{ left: lineInset, right: lineInset }} />
        {data.directReports.map((node) => (
          <div key={node.title} className="flex flex-col items-center">
            <div className="hidden h-5 w-px bg-slate-500 md:block" />
            <div className="w-full">
              <OrgChartNode node={node} />
            </div>
          </div>
        ))}
      </div>

      {/* Secciones adicionales */}
      {data.sections.map((section) => (
        <div key={section.title} className="mt-8 w-full">
          <SectionTitle title={section.title} />
          <div className={`mt-4 grid grid-cols-2 gap-4 ${getColumnsClass(section.nodes.length)}`}>
            {section.nodes.map((node) => (
              <OrgChartNode key={node.title} node={node} />
            ))}
          </div>
        </div>
      ))}

      <p className="mt-8 text-center text-xs text-muted-foreground">{data.footnote}</p>
    </div>
  )
}

// Título centrado con una línea a cada lado.
function SectionTitle({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-border" />
      <p className="text-center text-xs font-semibold text-amber-300">{title}</p>
      <div className="h-px flex-1 bg-border" />
    </div>
  )
}
