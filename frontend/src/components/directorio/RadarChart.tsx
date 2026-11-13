import type { Competency } from '@/data/sample-talent'

interface RadarChartProps {
  competencies: Competency[]
}

const SIZE = 220
const CENTER = SIZE / 2
const MAX_RADIUS = 70

// Calcula la posición (x, y) de un punto en el gráfico.
// index: número del eje (0, 1, 2...); value: valor de 0 a 100.
function getPoint(index: number, total: number, value: number) {
  // El primer eje apunta hacia arriba; los demás se reparten en círculo.
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2
  const radius = (value / 100) * MAX_RADIUS
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

// Gráfico de radar simple con SVG: nivel actual vs. nivel requerido por el cargo.
export function RadarChart({ competencies }: RadarChartProps) {
  const total = competencies.length
  const currentValues = competencies.map((competency) => competency.current)
  const requiredValues = competencies.map((competency) => competency.required)
  const gridLevels = [25, 50, 75, 100]

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="mx-auto w-full max-w-60">
      {/* Líneas de fondo (25%, 50%, 75% y 100%) */}
      {gridLevels.map((level) => (
        <polygon
          key={level}
          points={toPolygonPoints(competencies.map(() => level))}
          fill="none"
          className="stroke-border"
        />
      ))}

      {/* Ejes y nombres de cada competencia */}
      {competencies.map((competency, index) => {
        const axisEnd = getPoint(index, total, 100)
        const labelPosition = getPoint(index, total, 125)
        return (
          <g key={competency.name}>
            <line x1={CENTER} y1={CENTER} x2={axisEnd.x} y2={axisEnd.y} className="stroke-border" />
            <text
              x={labelPosition.x}
              y={labelPosition.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-muted-foreground text-[9px]"
            >
              {competency.name}
            </text>
          </g>
        )
      })}

      {/* Nivel requerido por el cargo (línea punteada) */}
      <polygon
        points={toPolygonPoints(requiredValues)}
        fill="none"
        strokeDasharray="4 3"
        className="stroke-muted-foreground"
      />

      {/* Nivel actual de la persona */}
      <polygon points={toPolygonPoints(currentValues)} className="fill-primary/20 stroke-primary" strokeWidth="1.5" />
    </svg>
  )
}
