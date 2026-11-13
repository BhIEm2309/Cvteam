import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@/index.css'
import App from './App.tsx'

// TanStack Query guarda en memoria las respuestas de la API y permite recargarlas.
// retry: false porque el respaldo con datos de ejemplo ya ocurre dentro de cada consulta (load-data.ts);
// reintentar solo retrasaría varios segundos el error cuando la API no responde.
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
