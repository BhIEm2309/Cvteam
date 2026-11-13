import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description: string
  // Contenido opcional a la derecha del título (por ejemplo, un botón).
  actions?: ReactNode
}

// Título y descripción que van arriba de cada página.
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {actions}
    </div>
  )
}
