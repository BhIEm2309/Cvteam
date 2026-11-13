import { Outlet } from 'react-router'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

// Estructura común de todas las páginas: barra lateral + barra superior + contenido.
// <Outlet /> es el lugar donde react-router dibuja la página actual.
export function AppLayout() {
  return (
    <div className="flex min-h-svh bg-background bg-gradient-to-br from-background to-[#0d2347]">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 px-4 py-6 md:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
