interface DonutChartProps {
  // Porcentaje a mostrar, de 0 a 100.
  percent: number
  label: string
}

// Gráfico circular simple hecho con SVG: un círculo de fondo y un arco que representa el porcentaje.
export function DonutChart({ percent, label }: DonutChartProps) {
  const radius = 40
  const circumference = 2 * Math.PI * radius
  // Largo del arco visible según el porcentaje.
  const visibleLength = (percent / 100) * circumference

  return (
    <div className="relative size-32">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" strokeWidth="9" className="stroke-secondary" />
        {/* Con 0% no se dibuja el arco: si no, quedaría un punto suelto por el borde redondeado. */}
        {percent > 0 && (
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={`${visibleLength} ${circumference}`}
            className="stroke-primary"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold text-foreground">{percent}%</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
    </div>
  )
}
