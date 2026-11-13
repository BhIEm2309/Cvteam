import { Navigate, Route, Routes } from 'react-router'
import { AppLayout } from '@/shared/layout/AppLayout'
import { HubPage } from '@/features/hub/HubPage'
import { IngestaPage } from '@/features/ingesta/IngestaPage'
import { ReviewPage } from '@/features/ingesta/ReviewPage'
import { DirectorioPage } from '@/features/directorio/DirectorioPage'
import { LaboratorioPage } from '@/features/laboratorio/LaboratorioPage'

// Rutas de la aplicación. Todas las páginas comparten la barra lateral (AppLayout).
// Para agregar una página: crearla en src/features/<pantalla>/, agregar su <Route> aquí y su enlace en
// src/shared/layout/navigation.ts.
export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/hub" element={<HubPage />} />
        <Route path="/ingesta" element={<IngestaPage />} />
        <Route path="/ingesta/revision/:documentId" element={<ReviewPage />} />
        <Route path="/directorio" element={<DirectorioPage />} />
        <Route path="/laboratorio" element={<LaboratorioPage />} />
      </Route>

      {/* Cualquier otra dirección lleva al Hub. */}
      <Route path="*" element={<Navigate to="/hub" replace />} />
    </Routes>
  )
}
