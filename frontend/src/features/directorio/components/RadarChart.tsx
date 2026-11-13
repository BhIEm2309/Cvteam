import { MAX_LEVEL } from '../constants'

// Un eje del gráfico: nivel actual (0 si no la tiene o no tiene nivel) y nivel requerido (null = sin requisito).
export interface RadarAxis {
  name: string
  current: number
  required: number | null
}

interface RadarChartProps {
  axes: RadarAxis[]
}

const SIZE = 220
const CENTER = SIZE / 2
const MAX_RADIUS = 70

// Calcula la posición (x, y) de un punto. index: número del eje; value: nivel de 0 a MAX_LEVEL.
function getPoint(index: number, total: number, value: number) {
  // El primer eje apunta hacia arriba; los demás se reparten en círculo.
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2
  const radius = (value / MAX_LEVEL) * MAX_RADIUS
  return {
    x: CENTER + radius * Math.cos(angle),
    y: CENTER + radius * Math.sin(angle),
  }
}

// Convierte una lista de valores en el texto que necesita <polygon points="...">.
function toPolygonPoints(values: number[]): string {
  return values
    .map((value, index) => {
      const point = getPoint(index, values.length, value)
      return `${point.x},${point.y}`
    })
    .join(' ')
}

// Gráfico de radar con SVG: nivel actual vs. nivel requerido por el cargo (escala 1 a 5).
// Se necesitan al menos 3 ejes para formar una figura.
export function RadarChart({ axes }: RadarChartProps) {
  const total = axes.length
  const gridLevels = [1, 2, 3, 4, 5]
  const showRequired = axes.some((axis) => axis.required !== null)

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="mx-auto w-full max-w-60" role="img" aria-label="Mapa de competencias">
      {/* Líneas de fondo, una por nivel */}
      {gridLevels.map((level) => (
        <polygon key={level} points={toPolygonPoints(axes.map(() => level))} fill="none" className="stroke-border" />
      ))}

      {/* Ejes y nombres de cada competencia */}
      {axes.map((axis, index) => {
        const axisEnd = getPoint(index, total, MAX_LEVEL)
        const labelPosition = getPoint(index, total, MAX_LEVEL * 1.25)
        return (
          <g key={axis.name}>
            <line x1={CENTER} y1={CENTER} x2={axisEnd.x} y2={axisEnd.y} className="stroke-border" />
            <text
              x={labelPosition.x}
              y={labelPosition.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-muted-foreground text-[9px]"
            >
              {axis.name.length > 18 ? `${axis.name.slice(0, 17)}…` : axis.name}
            </text>
          </g>
        )
      })}

      {/* Nivel requerido por el cargo (línea punteada). Un requisito sin nivel se dibuja en 0. */}
      {showRequired && (
        <polygon
          points={toPolygonPoints(axes.map((axis) => axis.required ?? 0))}
          fill="none"
          strokeDasharray="4 3"
          className="stroke-muted-foreground"
        />
      )}

      {/* Nivel actual de la persona */}
      <polygon points={toPolygonPoints(axes.map((axis) => axis.current))} className="fill-primary/20 stroke-primary" strokeWidth="1.5" />
    </svg>
  )
}
