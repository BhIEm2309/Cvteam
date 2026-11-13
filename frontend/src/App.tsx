import { Navigate, Route, Routes } from 'react-router'
import { AppLayout } from '@/components/layout/AppLayout'
import { HubPage } from '@/pages/HubPage'
import { IngestaPage } from '@/pages/IngestaPage'
import { DirectorioPage } from '@/pages/DirectorioPage'
import { LaboratorioPage } from '@/pages/LaboratorioPage'

// Rutas de la aplicación. Todas las páginas comparten la barra lateral (AppLayout).
// Para agregar una página: crearla en src/pages, agregar su <Route> aquí y su enlace en Sidebar.tsx.
export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/hub" element={<HubPage />} />
        <Route path="/ingesta" element={<IngestaPage />} />
        <Route path="/directorio" element={<DirectorioPage />} />
        <Route path="/laboratorio" element={<LaboratorioPage />} />
      </Route>

      {/* Cualquier otra dirección lleva al Hub. */}
      <Route path="*" element={<Navigate to="/hub" replace />} />
    </Routes>
  )
}
