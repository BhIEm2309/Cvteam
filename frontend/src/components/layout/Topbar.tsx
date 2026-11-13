import { NavLink, useLocation } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { NAVIGATION_ITEMS } from './navigation'

// Barra superior: muestra en qué página está el usuario.
// En pantallas chicas también muestra el menú, porque la barra lateral se oculta.
export function Topbar() {
  const location = useLocation()
  const currentPage = NAVIGATION_ITEMS.find((item) => item.path === location.pathname)

  return (
    <header className="border-b border-border bg-sidebar/60">
      <div className="flex h-14 items-center justify-between gap-4 px-4 md:px-8">
        <p className="text-sm text-muted-foreground">
          RoleFit <span className="mx-1">/</span>
          <span className="text-primary">{currentPage ? currentPage.label : 'Inicio'}</span>
        </p>
        <Badge variant="outline" className="border-primary/40 text-primary">
          Modo demostración
        </Badge>
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
