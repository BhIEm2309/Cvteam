# Frontend — Diagnóstico Organizacional Inteligente (RoleFit)

Stack: React 19 + Vite 7 + TypeScript, Tailwind CSS 4, shadcn/ui, TanStack Query, React Router 7, Zod.

## Uso

Con Docker (recomendado), desde la carpeta `Proyecto`: `docker compose up --build` y abrir http://localhost:5173.

Sin Docker (requiere Node 22+ y pnpm 10, y la API corriendo en el puerto 3000):

```powershell
pnpm install
pnpm dev        # http://localhost:5173
pnpm build      # verifica tipos y genera dist/
pnpm lint
```

## Páginas

| Ruta | Página | Datos |
|---|---|---|
| `/hub` | Hub de organizaciones | Ejemplo (`src/features/hub/mock.ts`) |
| `/ingesta` | Carga de CVs | **API real**: `GET` y `POST /api/documents` (`src/features/ingesta/api.ts`) |
| `/directorio` | Directorio de talento | Ejemplo (`src/features/directorio/mock.ts`) |
| `/laboratorio` | Organigrama actual vs. propuesto | Ejemplo (`src/features/laboratorio/mock.ts`) |

Las páginas con datos de ejemplo muestran un aviso (`SampleDataNotice`). Al conectarlas a la API, se
agrega un `api.ts` en la carpeta de la pantalla y se quita el aviso.

## Estructura

```
src/
  app/
    main.tsx               arranque: React Router + TanStack Query
    App.tsx                rutas de la aplicación
  index.css                Tailwind y colores del tema (bloque .dark)
  shared/
    ui/                    componentes de shadcn/ui (generados, no editar a mano)
    layout/                barra lateral, barra superior y menú (navigation.ts)
    components/            PageHeader, StatCard, DonutChart, SampleDataNotice
    lib/                   format.ts, validate-file.ts, utils.ts
  features/
    hub/ ingesta/ directorio/ laboratorio/
      <Pantalla>Page.tsx   la página
      components/          componentes propios de la pantalla
      api.ts               llamadas a la API (por ahora solo en ingesta)
      mock.ts              datos de ejemplo (temporales)
```

## Cómo agregar una página

1. Crear `src/features/mi-pagina/MiPaginaPage.tsx`.
2. Agregar su ruta en `src/app/App.tsx`: `<Route path="/mi-pagina" element={<MiPaginaPage />} />`.
3. Agregar el enlace del menú en `src/shared/layout/navigation.ts`.

## Componentes de shadcn/ui

```powershell
pnpm dlx shadcn@4.22.2 add <componente>   # por ejemplo: dialog, dropdown-menu
```

Quedan en `src/shared/ui/` (configurado en `components.json`). El alias `@/` apunta a `src/`. Los colores se toman de las variables
del bloque `.dark` en `src/index.css` (la aplicación usa siempre el tema oscuro).
