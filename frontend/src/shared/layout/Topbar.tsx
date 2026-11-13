import { NavLink, useLocation } from 'react-router'
import { Badge } from '@/shared/ui/badge'
import { APP_NAME } from '@/shared/lib/brand'
import { DATA_MODE } from '@/shared/lib/data-mode'
import { useSourceStatus, type SourceStatus } from '@/shared/lib/data-source'
import { NAVIGATION_ITEMS } from './navigation'

// Texto y color del indicador de fuente de datos de la pantalla actual.
const SOURCE_BADGES: Record<SourceStatus, { label: string; className: string }> = {
  cargando: { label: 'Cargando…', className: 'border-border text-muted-foreground' },
  conectado: { label: 'Conectado', className: 'border-emerald-400/40 text-emerald-400' },
  ejemplo: { label: 'Datos de ejemplo', className: 'border-amber-400/40 text-amber-300' },
  'sin-conexion': { label: 'Sin conexión', className: 'border-red-400/40 text-red-400' },
  error: { label: 'Error de la API', className: 'border-red-400/40 text-red-400' },
}

// Barra superior: muestra en qué página está el usuario y de dónde vienen sus datos.
// En pantallas chicas también muestra el menú, porque la barra lateral se oculta.
export function Topbar() {
  const location = useLocation()
  const currentPage = NAVIGATION_ITEMS.find((item) => item.path === location.pathname)
  const sourceStatus = useSourceStatus(location.pathname)
  const sourceBadge = sourceStatus ? SOURCE_BADGES[sourceStatus] : null

  return (
    <header className="border-b border-border bg-sidebar/60">
      <div className="flex h-14 items-center justify-between gap-4 px-4 md:px-8">
        <p className="text-sm text-muted-foreground">
          {APP_NAME} <span className="mx-1">/</span>
          <span className="text-primary">{currentPage ? currentPage.label : 'Inicio'}</span>
        </p>
        {sourceBadge && (
          <Badge variant="outline" className={sourceBadge.className} title={`Modo de datos: ${DATA_MODE}`}>
            {sourceBadge.label}
          </Badge>
        )}
      </div>

      {/* Menú para pantallas chicas */}
      <nav className="flex gap-1 overflow-x-auto px-4 pb-3 lg:hidden">
        {NAVIGATION_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              isActive
                ? 'shrink-0 rounded-md bg-accent px-3 py-1.5 text-sm text-primary'
                : 'shrink-0 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent/60'
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </header>
  )
}
