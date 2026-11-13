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
| `/hub` | Hub de organizaciones | Ejemplo (`src/data/sample-organizations.ts`) |
| `/ingesta` | Carga de CVs | **API real**: `GET` y `POST /api/documents` |
| `/directorio` | Directorio de talento | Ejemplo (`src/data/sample-talent.ts`) |
| `/laboratorio` | Organigrama actual vs. propuesto | Ejemplo (`src/data/sample-org-chart.ts`) |

Las páginas con datos de ejemplo muestran un aviso (`SampleDataNotice`). Al conectarlas a la API, se
reemplaza el archivo de `src/data/` por una función en `src/lib/api.ts` y se quita el aviso.

## Estructura

```
src/
  main.tsx                 arranque: React Router + TanStack Query
  App.tsx                  rutas de la aplicación
  index.css                Tailwind y colores del tema (bloque .dark)
  pages/                   una página por ruta
  components/
    layout/                barra lateral, barra superior y menú (navigation.ts)
    ingesta/ directorio/ laboratorio/ hub/   componentes de cada página
    ui/                    componentes de shadcn/ui (generados)
    PageHeader.tsx, StatCard.tsx, DonutChart.tsx, SampleDataNotice.tsx   componentes compartidos
  lib/
    api.ts                 llamadas a la API
    format.ts              formato de fechas, tamaños y números
    validate-file.ts       validación de archivos con Zod
  data/                    datos de ejemplo (temporales)
```

## Cómo agregar una página

1. Crear `src/pages/MiPaginaPage.tsx`.
2. Agregar su ruta en `src/App.tsx`: `<Route path="/mi-pagina" element={<MiPaginaPage />} />`.
3. Agregar el enlace del menú en `src/components/layout/navigation.ts`.

## Componentes de shadcn/ui

```powershell
pnpm dlx shadcn@4.22.2 add <componente>   # por ejemplo: dialog, dropdown-menu
```

Quedan en `src/components/ui/`. El alias `@/` apunta a `src/`. Los colores se toman de las variables
del bloque `.dark` en `src/index.css` (la aplicación usa siempre el tema oscuro).
