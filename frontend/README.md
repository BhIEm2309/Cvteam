# Frontend — Diagnóstico Organizacional Inteligente ("Organigrama Vivo", nombre de trabajo)

Stack: React 19 + Vite 7 + TypeScript, Tailwind CSS 4, shadcn/ui, TanStack Query, React Router 7, Zod.

## Uso

Con Docker (recomendado), desde la raíz del repositorio (`Cvteam`): `docker compose up --build` y abrir http://localhost:5173.

Sin Docker (requiere Node 22+ y pnpm 10, y la API corriendo en el puerto 3000):

```powershell
pnpm install
pnpm dev        # http://localhost:5173
pnpm build      # verifica tipos y genera dist/
pnpm lint
```

## Páginas

| Ruta | Página | Ruta de la API | ¿Existe en la API? |
|---|---|---|---|
| `/hub` | Hub de organizaciones | `GET /api/organizations` (provisional) | No: usa datos de ejemplo |
| `/ingesta` | Carga de CVs | `GET` y `POST /api/documents` | **Sí** |
| `/directorio` | Directorio de talento | `GET /api/employees` (provisional) | No: usa datos de ejemplo |
| `/laboratorio` | Organigrama actual vs. propuesto | `GET /api/scenarios/org-chart` (provisional) | No: usa datos de ejemplo |

## Modo de datos

Variable `VITE_DATA_MODE` (en Docker: `docker-compose.yml`; sin Docker: copiar `.env.example` como `.env.local`).

| Modo | Qué hace |
|---|---|
| `auto` (por defecto) | Llama a la API. Usa datos de ejemplo **solo** si la API no responde o la ruta todavía no existe (404 "Cannot GET…" de NestJS, o 501). Cualquier otro error (400, 500, 404 de un recurso) se muestra: nunca se esconde un bug detrás de datos de ejemplo. |
| `api` | Nunca usa datos de ejemplo. Sirve para probar la conexión real. |
| `mock` | Siempre usa datos de ejemplo. Sirve para presentar sin backend. |

- Cuando una pantalla muestra datos de ejemplo, aparece un aviso amarillo con el motivo.
- La barra superior indica la fuente de la pantalla actual: **Conectado**, **Datos de ejemplo**,
  **Sin conexión** (modo `api` con la API apagada), **Error de la API** o **Cargando…**.
- En Ingesta, si la lista son datos de ejemplo, lo que se sube se simula en memoria y se pierde al recargar.
  Si la lista vino de la API, una subida fallida muestra el error (no se simula).
- Con la API apagada, el proxy de Vite responde 503 con el encabezado `X-Api-No-Disponible` (ver
  `vite.config.ts`). Sin eso, Vite respondería 500 y no se podría distinguir de un error real de la API.

Cada pantalla tiene `types.ts` (esquemas Zod), `api.ts` (llamadas a la API), `mock.ts` (datos de ejemplo) y
`constants.ts` (etiquetas y colores). `api.ts` valida las respuestas con los esquemas de `types.ts` y
`mock.ts` usa los mismos tipos, así los datos de ejemplo no quedan desactualizados respecto de la API.

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
    components/            PageHeader, StatCard, DonutChart, SampleDataNotice, LoadState
    lib/
      data-mode.ts         lee y valida VITE_DATA_MODE
      http.ts              cliente HTTP y tipos de error (API no disponible, ruta inexistente, error real)
      load-data.ts         reglas del modo de datos: cuándo usar datos de ejemplo
      data-source.ts       fuente de datos de cada pantalla, para la barra superior
      format.ts, validate-file.ts, utils.ts
  features/
    hub/ ingesta/ directorio/ laboratorio/
      <Pantalla>Page.tsx   la página
      components/          componentes propios de la pantalla
      types.ts             esquemas Zod y tipos (contrato con la API)
      api.ts               llamadas a la API
      mock.ts              datos de ejemplo (mismos tipos)
      constants.ts         etiquetas y colores de la interfaz
```

## Cómo agregar una página

1. Crear `src/features/mi-pagina/MiPaginaPage.tsx`, con `types.ts`, `api.ts` y `mock.ts`.
2. En la página: `useQuery` con la función de `api.ts`, `useReportSourceStatus('/mi-pagina', getSourceStatus(query))`,
   y `<SampleDataNotice reason={...} />` cuando `query.data.source === 'mock'`.
3. Agregar su ruta en `src/app/App.tsx`: `<Route path="/mi-pagina" element={<MiPaginaPage />} />`.
4. Agregar el enlace del menú en `src/shared/layout/navigation.ts`.

## Componentes de shadcn/ui

```powershell
pnpm dlx shadcn@4.23.0 add <componente>   # por ejemplo: dialog, dropdown-menu
```

Quedan en `src/shared/ui/` (configurado en `components.json`). El alias `@/` apunta a `src/`. Los colores se toman de las variables
del bloque `.dark` en `src/index.css` (la aplicación usa siempre el tema oscuro).
