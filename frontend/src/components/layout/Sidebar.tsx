import { NavLink } from 'react-router'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { NAVIGATION_ITEMS } from './navigation'

// Barra lateral izquierda: logo, empresa activa, menú y usuario.
// Solo se muestra en pantallas grandes (lg); en pantallas chicas el menú está en la barra superior.
export function Sidebar() {
  return (
    // sticky + h-svh: la barra queda fija a la izquierda aunque la página sea larga.
    <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-4">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
          RF
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight text-foreground">RoleFit</p>
          <p className="text-xs text-muted-foreground">Consulting</p>
        </div>
      </div>

      {/* Empresa con la que se está trabajando */}
      <div className="px-4 pt-4">
        <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/50 px-3 py-2.5">
          <p className="text-[10px] font-semibold tracking-wider text-primary uppercase">Cliente activo</p>
          <p className="text-sm font-medium text-foreground">Empresa Demo</p>
        </div>
      </div>

      {/* Menú */}
      <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
        {NAVIGATION_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              isActive
                ? 'flex items-center gap-3 rounded-lg bg-sidebar-accent px-3 py-2 text-sm font-medium text-primary'
                : 'flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent/60'
            }
          >
            <item.icon className="size-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Usuario (modo demostración: todavía no existe login) */}
      <div className="flex items-center gap-3 border-t border-sidebar-border px-4 py-3">
        <Avatar className="size-8">
          <AvatarFallback className="bg-sidebar-accent text-xs text-primary">UD</AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-medium text-foreground">Usuario Demo</p>
          <p className="text-xs text-muted-foreground">Modo demostración</p>
        </div>
      </div>
    </aside>
  )
}
