# CLAUDE.md — Contexto del proyecto

Este archivo lo lee Claude Code al abrir la carpeta. También sirve como guía para el equipo.

## 1. Qué es el proyecto

Plataforma SaaS B2B de **diagnóstico organizacional**: analiza CVs y perfiles de cargo de una empresa, detecta
roles críticos faltantes y personas que asumen funciones ajenas, y propone una reestructuración basada en datos.
**La decisión final siempre la toma una persona**: la IA propone, no decide.

- Cliente: la empresa (B2B). Foco inicial: minería e industria de la Región de Coquimbo, Chile.
- Ramo: "Negocios desde la Ingeniería" (UCN). Equipo: Benjamín Miranda (CEO y Producto),
  Monserratt Aravena (Comercial y Marketing), Juan Contreras (Finanzas y Operaciones).
- Nombre de marca: **todavía no definido**. Nombre de trabajo: "Organigrama Vivo".
  **No usar "RoleFit"**: es la marca de otro equipo.

## 2. Cómo trabajar en este repo

- Rama de trabajo: `Test`. No hacer commits en `main`. Commits pequeños, un objetivo por commit.
- Avanzar paso a paso. **Antes de un cambio grande, presentar el plan y esperar aprobación.**
- **Avisar explícitamente** cualquier error, inconsistencia o bug encontrado. No corregir en silencio.
- Explicar el porqué de cada decisión, en español simple.
- Después de cada paso: `pnpm build` y `pnpm lint` en `frontend/`, `pnpm typecheck` en `api/`.
  Si algo falla, decirlo; no ocultarlo.
- No describir como "funcional" algo que muestra datos de ejemplo.
- Código, comentarios y mensajes de la interfaz en español (como el código existente).

## 3. Cómo levantarlo

Requisito: Docker Desktop abierto. En la raíz: `docker compose up --build`.

| Servicio | Dirección |
|---|---|
| Frontend | http://localhost:5173 |
| API | http://localhost:3000/api/health |
| PostgreSQL | localhost:5433 · base/usuario `diagnostico` · clave `diagnostico_dev` |

Más detalle en `README.md`, `api/README.md` y `frontend/README.md`.

## 4. Stack y reglas técnicas

- Frontend: React 19, Vite 7, TypeScript, Tailwind 4, shadcn/ui, TanStack Query, React Router 7, Zod.
- Backend: NestJS 11, Prisma 6, PostgreSQL 17.
- **Prisma es el único dueño del esquema**: `api/prisma/schema.prisma` + `api/prisma/migrations/` son la
  única fuente de verdad. Para cambiar la base: editar `schema.prisma` y ejecutar `pnpm db:migrate`.
  No usar `prisma db push`. `DB/001_schema.sql` es una copia histórica: **no editarla** para cambiar la base.
- Toda consulta filtra por `organizationId` obtenido de `CurrentOrganizationService`; nunca desde el navegador.
- Los resultados de IA se guardan como **propuestos** (pendientes de revisión humana) y nunca modifican
  automáticamente los datos confirmados.
- Claves de API (IA u otras) solo en el `.env` del backend. Nunca en el frontend ni en el repo.

## 5. Estado actual (13-11-2026)

- Real: Ingesta de CVs (subir PDF, listar, ver). API de áreas (`/api/departments`) sin pantalla.
- Datos de ejemplo: Hub, Directorio de Talento y Laboratorio (importan directo desde `frontend/src/data/`).
- No existe: login, IA, módulos de organizaciones, puestos y trabajadores.
- Base de datos: 28 tablas diseñadas y migradas (`docs/diseno-base-de-datos.md`). Etapa A de 5 completada.

## 6. Problemas conocidos (pendientes)

1. Marca "RoleFit" en `Sidebar.tsx` (logo "RF" + "RoleFit Consulting"), `Topbar.tsx`, `frontend/README.md`
   y un comentario de `index.css`.
2. `frontend/src/data/sample-org-chart.ts`: "2 de 5 ingenieros" no cuadra con el organigrama
   (hay 1 ingeniero; los 5 son técnicos). Corregir a "3 de 8 técnicos senior" junto con los datos del punto 3.
3. Datos de ejemplo de Compresores del Sur deben alinearse con el diseño de Figma: 62 colaboradores,
   Técnicos senior x8, Técnicos junior x34, 47 CVs cargados, 43 procesados, 4 con error, 312 habilidades.
   Usar solo empresas **ficticias** (las del repo), nunca empresas reales.
4. Dependencia `"cn": "0.5.2"` en `frontend/package.json` (usada en `src/lib/utils.ts`). shadcn/ui
   normalmente usa `clsx` + `tailwind-merge`. Verificar el paquete; propuesta: reemplazarlo por
   `clsx` + `tailwind-merge`.
5. `docs/avance.md` y `frontend/README.md` mencionan una carpeta "Proyecto" (el repo se llama Cvteam).
   `docs/diseno-base-de-datos.md` dice que "todavía no es una migración ejecutada" (ya lo es).
6. La interfaz de diseño menciona "PDF o Word"; la API solo acepta PDF.
7. La barra superior dice siempre "Modo demostración", aunque la Ingesta sí está conectada.

## 7. Estructura objetivo

### Backend (ya está bien): un módulo por funcionalidad

```
api/src/modules/<modulo>/   <modulo>.controller.ts · <modulo>.service.ts · <modulo>.module.ts · tipos
```

Módulos existentes: `documents`, `departments`. Próximos: `organizations`, `positions`, `employees`,
`skills`, `extraction`, `diagnostics`, `scenarios`.

### Frontend: una carpeta por pantalla (pendiente de reorganizar)

```
frontend/src/
  app/                    main.tsx, App.tsx (rutas), proveedores
  shared/
    ui/                   componentes shadcn (generados, no editar a mano)
    layout/               Sidebar, Topbar, AppLayout, navigation.ts
    components/           PageHeader, StatCard, DonutChart, aviso de datos de ejemplo
    lib/                  cliente HTTP, modo de datos, format.ts, utils.ts, validate-file.ts
  features/
    hub/                  HubPage.tsx · components/ · api.ts · mock.ts · types.ts
    ingesta/              igual
    directorio/           igual
    laboratorio/          igual
```

Relación pantalla → módulos del backend:

| Pantalla (frontend) | Módulos (backend) |
|---|---|
| hub | organizations |
| ingesta | documents, extraction |
| directorio | employees, skills |
| laboratorio | positions, diagnostics, scenarios |

### Modo de datos (pendiente de implementar)

Variable `VITE_DATA_MODE`:
- `auto` (por defecto): cada `api.ts` llama a la API. Usa `mock.ts` **solo** si la API no responde
  (error de red) o la ruta no existe todavía (404/501). Si la API responde con otro error (400, 500…),
  se muestra el error: **nunca** se esconde un bug detrás de datos de ejemplo.
- `api`: nunca usar mocks (para probar la conexión real).
- `mock`: siempre mocks (para presentar sin backend).

Reglas:
- `api.ts` y `mock.ts` de una pantalla usan los mismos tipos de `types.ts` (validados con Zod), para que
  los mocks no queden desactualizados respecto de la API.
- Cuando una pantalla muestra datos de ejemplo, se ve un aviso amarillo visible.
- La barra superior indica la fuente real: "Conectado" o "Datos de ejemplo".
- En modo mock, las acciones que escriben (por ejemplo subir un CV) se simulan en memoria y se pierden
  al recargar; el aviso lo dice.

## 8. IA (pendiente, después de reorganizar)

Módulo `api/src/modules/extraction/`:
1. PDF → texto (por ejemplo `pdf-parse`).
2. Texto → modelo de lenguaje con respuesta en un esquema JSON fijo.
3. Validar la respuesta con Zod; si falla, el documento queda en error.
4. Guardar en `extraction_runs` y las habilidades en `employee_skills` como **propuestas**.
5. Estado del documento: Pendiente → Procesando → Completado / Error (el frontend consulta periódicamente).

- CVs → competencias (`skills`, `employee_skills`). Perfiles de cargo → funciones esperadas (`responsibilities`).
- El diagnóstico (cruce entre funciones esperadas, funciones reales y competencias) se hace con **reglas
  explicables** guardando su evidencia (`findings`, `finding_evidence`), no con IA.
- El proveedor de IA va detrás de una interfaz (`ExtractionProvider`) para poder cambiarlo
  (API externa o modelo local).

## 9. Orden de trabajo

1. Reorganizar el frontend por pantallas (solo mover archivos y ajustar imports; la interfaz no cambia).
2. Modo de datos `auto`/`api`/`mock`, indicador en la barra superior, pasar las 4 pantallas a `api.ts` + `mock.ts`.
3. Limpieza: problemas conocidos de la sección 6.
4. Backend etapa B: `organizations`, `positions`, `employees` + importador de organigrama desde CSV
   (nombre, cargo, área, jefe directo).
5. IA de extracción (sección 8).
6. Encuesta de funciones reales (puede quedar con datos de ejemplo para la entrega).
