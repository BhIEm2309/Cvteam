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
- Después de cada paso: `pnpm build` y `pnpm lint` en `frontend/`, `pnpm typecheck` y `pnpm test` en `api/`.
  Si el cambio toca la API o la base: también `pnpm test:integration` en `api/` (PGlite, sin Docker, ~15 s).
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

- Real: Ingesta de CVs (subir PDF, listar, ver) con análisis de competencias por IA (paso 5a). API de áreas
  (`/api/departments`) sin pantalla.
- Frontend organizado por pantallas (`app/`, `shared/`, `features/<pantalla>/`) con modo de datos
  `auto`/`api`/`mock` implementado. La barra superior muestra la fuente real de cada pantalla.
- Backend etapa B escrito (paso 4): `organizations` (Hub), `positions`, `employees` e importador de
  organigrama CSV (`POST /api/org-chart/import?mode=preview|apply`, con tarjeta en Ingesta).
  Probado contra PostgreSQL 17 en memoria (PGlite, sin Docker) el 13-11-2026: importar, reimportar sin duplicar,
  cambio de cargo, archivado y ciclos. La lectura y validación del CSV tiene pruebas (`pnpm test` en `api/`).
- IA (paso 5a): al subir un CV se encola su análisis (`extraction_runs`). Un proceso en segundo plano lo lee
  (`unpdf`), lo envía a Claude y guarda las competencias en `skill_proposals` como **propuestas** (PENDING).
  Ingesta muestra el estado (En cola / Analizando / Analizado / Error) y permite "Analizar de nuevo".
  Probado contra la base con una API de Anthropic falsa; **nunca con la API real** (falta `ANTHROPIC_API_KEY`).
- Revisión humana (paso 5b): página `/ingesta/revision/:documentId`. Quien revisa elige la persona (o la crea),
  corrige nombre, categoría y nivel, y confirma o descarta. Confirmar crea `skills` (si no existe), `evidence` y
  `employee_skills` (DECLARED) en una transacción; una competencia que la persona ya tenía no se modifica.
  Probado con PGlite y en el navegador.
- Directorio de Talento real (`/api/talent`): competencias confirmadas, requisitos por cargo (`/api/skills`,
  `/api/positions/:id/skills`, editables en el panel de perfil) y ajuste calculado con la regla explicable de
  `api/src/modules/talent/fit-rules.ts` (sin requisitos no hay ajuste). Probado con PGlite y en el navegador.
- Datos de ejemplo: Laboratorio (`/api/scenarios/org-chart`, provisional). Hub usa la API real cuando responde.
- No existe: login, pantalla del catálogo de habilidades, perfiles de cargo con IA, diagnóstico, escenarios.
- Base de datos: 29 tablas (28 del diseño + `skill_proposals`, paso 5) en 2 migraciones (`docs/diseno-base-de-datos.md`).
- Nombre visible: "Organigrama Vivo" (nombre de trabajo), centralizado en `frontend/src/shared/lib/brand.ts`.
- Pasos 1 a 5 de la sección 9 completados (5a: análisis con IA; 5b: revisión humana).

## 6. Problemas conocidos (pendientes)

1. El organigrama de ejemplo suma ~46 personas (1 + 1 + 8 + 34 + 1 + 1) y Figma dice 62 colaboradores.
   Confirmar con el diseño si hay personal fuera del organigrama.
2. El diseño de Figma menciona "PDF o Word"; la API y la interfaz solo aceptan PDF. Corregir en Figma
   (o decidir soportar Word, que sería una funcionalidad nueva).
3. Docker Desktop no está instalado en el equipo de Benjamín: falta probar `docker compose up --build`
   (Node 22 en Alpine cargando `unpdf`, que es un módulo ES, con `require`). Los endpoints ya se probaron con PGlite.
4. Con `VITE_DATA_MODE` inválido la app se detiene y el error solo aparece en la consola (página en blanco).
5. El esquema no guarda RUT de la organización: `taxId` siempre es `null` (requiere una migración).
6. Hub con la API real muestra solo "Empresa Demo" (sin login, el usuario pertenece a una organización).
7. El importador crea los cargos con `targetHeadcount = 1` (valor por defecto de la base), aunque el CSV tenga
   más personas en ese cargo (por ejemplo, 2 "Técnico senior"). Cuando se calculen vacantes, se verán como
   sobredotación. Decidir: usar la cantidad de personas del archivo o dejar que alguien lo ajuste.
8. **Datos personales:** los CVs se envían a un servicio externo (Anthropic). Antes de usarlo con clientes reales
   hace falta su consentimiento y revisar la ley chilena de datos personales (19.628, reemplazada por la 21.719).
   El texto de cada CV queda guardado en `extraction_runs.extracted_text` (falta definir cuánto tiempo).
9. El análisis de CVs con IA no se ha probado con la API real de Anthropic ni con CVs reales (calidad, costo).
10. Un CV analizado no se puede volver a analizar (la API responde 409) para no duplicar propuestas. Las
    decisiones de la revisión no se pueden deshacer desde la pantalla (quedan en la auditoría).
11. Dos revisiones simultáneas del mismo CV: la segunda recibe 409 y no guarda nada. Se probó con PGlite, que
    ejecuta las consultas de a una; falta probarlo con PostgreSQL real y conexiones paralelas.
12. Competencias equivalentes con distinto nombre ("SAP PM" y "SAP Plant Maintenance") quedan separadas en el
    catálogo. Unirlas requiere una pantalla de catálogo (no existe).
13. El Directorio usa solo el cargo principal de cada persona (mayor dedicación); una persona con dos cargos se
    evalúa contra uno solo.
14. Los requisitos de cada cargo se definen a mano. Ningún cargo los tiene al importar un organigrama.

Decisión del 13-11-2026: los umbrales del ajuste al cargo quedan confirmados (crítico bajo 60 % o si falta una
obligatoria; desaprovechado con 100 % y +1 nivel promedio; competencia sin nivel = 0,5). Están en `FIT_RULES`
(`api/src/modules/talent/fit-rules.ts`); cambiarlos es una decisión de negocio.

Resueltos en el paso 5a: datos de ejemplo "43 procesados, 4 con error, 312 habilidades" (ahora caben en el
contrato), y la API fuera de Docker no leía `api/.env` (ahora `config.ts` lo carga con `process.loadEnvFile`).

Resuelto después del paso 4: `PATCH /api/departments/:id` ahora rechaza ciclos largos (A → B → A), igual que
`positions` (`assertNoCycle`).

Resueltos en el paso 3: marca "RoleFit", "2 de 5 ingenieros", cifras de Compresores del Sur (62, x8, x34,
47 CVs), carpeta "Proyecto" en la documentación, estado de la migración, "Modo demostración" en la barra
superior. El paquete `cn` se mantiene: es el paquete oficial de shadcn (`shadcn-ui/cn`) y los componentes
generados lo importan directamente.

## 7. Estructura objetivo

### Backend (ya está bien): un módulo por funcionalidad

```
api/src/modules/<modulo>/   <modulo>.controller.ts · <modulo>.service.ts · <modulo>.module.ts · tipos
```

Módulos existentes: `documents`, `departments`, `organizations`, `positions`, `employees`, `org-chart-import`,
`extraction`, `skills`, `talent`. Próximos: `diagnostics`, `scenarios`. Validación de entradas en `src/common/input.ts`.

### Frontend: una carpeta por pantalla (implementado; además cada pantalla tiene `constants.ts`)

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
| hub | organizations (+ importador de organigrama en la pantalla Ingesta) |
| ingesta | documents, extraction |
| directorio | talent, skills |
| laboratorio | positions, diagnostics, scenarios |

### Modo de datos (implementado: ver `frontend/README.md`, sección "Modo de datos")

Precisión del 404: solo el 404 "Cannot GET …" de NestJS (ruta inexistente) usa mocks. Un 404 de un recurso
("no encontrado") se muestra como error. Con la API apagada, el proxy de Vite responde 503 con
`X-Api-No-Disponible: 1` para distinguirlo de un 500 real.

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

## 8. IA (pasos 5a y 5b implementados)

Módulo `api/src/modules/extraction/` (detalle en `api/README.md`, sección "Análisis de CVs con IA"):
1. PDF → texto con `unpdf` (`pdf-text.ts`). Sin texto (escaneado) → error `PDF_SIN_TEXTO`; no hay OCR.
2. Texto → Claude (`claude-extraction.provider.ts`, modelo `EXTRACTION_MODEL`, por defecto `claude-haiku-5-5`;
   alternativa `claude-sonnet-5-5` si la calidad no alcanza)
   con salida estructurada según `cv-extraction-schema.ts` y respaldo automático si el modelo rechaza.
3. Validar con Zod y descartar competencias cuyo fragmento citado no aparece en el CV (`proposals.ts`).
4. Guardar en `extraction_runs` y las competencias en `skill_proposals` (PENDING). **No** se escribe en
   `employee_skills`: esa tabla no tiene estado "pendiente" y su UNIQUE impide convivir con datos confirmados.
5. Estado: En cola → Analizando → Analizado / Error. La cola es la propia tabla (`FOR UPDATE SKIP LOCKED`), sin
   Redis/BullMQ. El frontend consulta cada 3 s mientras haya CVs en curso.
6. Revisión (paso 5b, `proposal-review.service.ts`): `POST /api/documents/:id/extraction/review`. Confirmar =
   vincular el CV a la persona y crear `skills` (por nombre normalizado), `evidence` (DOCUMENT) y `employee_skills`
   (DECLARED); descartar = DISMISSED. Una `employee_skills` existente nunca se modifica. Siempre una persona decide.

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
5. IA de extracción (sección 8). 5a (backend + estados en Ingesta) y 5b (revisión humana) hechos.
6. Encuesta de funciones reales (puede quedar con datos de ejemplo para la entrega).
