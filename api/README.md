# API — Diagnóstico Organizacional Inteligente

Stack: NestJS 11 + TypeScript 5.9, Prisma 6, PostgreSQL 17.

## Uso con Docker (recomendado)

Desde la raíz del repositorio (`Cvteam`): `docker compose up --build`. Al iniciar, el contenedor de la API aplica las
migraciones pendientes, carga los datos de demostración y arranca con recarga automática.

Comprobar: http://localhost:3000/api/health → `{"status":"ok"}`.

Para ejecutar comandos de Prisma dentro del contenedor: `docker compose exec api pnpm db:status`.

## Uso local (sin Docker para la API)

Requisitos: Node 22 o superior, pnpm 10 y la base del proyecto corriendo (`docker compose up -d db`, puerto 5433).

```powershell
copy .env.example .env    # solo la primera vez
pnpm install
pnpm db:deploy            # aplica migraciones pendientes
pnpm db:seed              # datos de demostración
pnpm start:dev            # http://localhost:3000/api — se recarga al guardar
```

## Comandos

| Comando | Qué hace |
|---|---|
| `pnpm start:dev` | API con recarga automática |
| `pnpm typecheck` | Revisa tipos sin compilar. Sin Docker, ejecutar antes `pnpm prisma:generate` (si no, falla con "no exported member DocumentType") |
| `pnpm build` / `pnpm start` | Compila a `dist/` / ejecuta lo compilado |
| `pnpm db:migrate` | Crea y aplica una migración a partir de los cambios en `schema.prisma` (desarrollo) |
| `pnpm db:deploy` | Aplica migraciones pendientes sin crear nuevas |
| `pnpm db:seed` | Carga los datos de demostración (idempotente) |
| `pnpm db:status` | Muestra qué migraciones están aplicadas |
| `pnpm db:reset` | **Borra la base**, aplica todas las migraciones y ejecuta el seed |
| `pnpm db:studio` | Abre Prisma Studio para ver y editar datos en el navegador |
| `pnpm prisma:generate` | Regenera el cliente Prisma |

## Base de datos y Prisma

- `prisma/schema.prisma` describe las 29 tablas (las 28 del diseño más `skill_proposals`), ordenadas según las secciones de
  `../docs/diseno-base-de-datos.md`. Modelos en PascalCase y campos en camelCase; `@map`/`@@map` dan el nombre real.
- `prisma/migrations/` es la fuente oficial de la estructura de la base. La primera migración
  (`20261112230000_init`) contiene el esquema completo, incluidos CHECK, exclusiones de fechas solapadas,
  índices parciales y triggers que Prisma no puede expresar en `schema.prisma`.
- `prisma/seed.ts` crea la "Empresa Demo" y su usuario OWNER.
- `prisma.config.ts` configura la CLI de Prisma (rutas y seed) y carga `.env`.

### Cambiar el esquema

1. Editar `prisma/schema.prisma`.
2. Ejecutar `pnpm db:migrate`. Prisma pide un nombre (por ejemplo `agregar_campo_x`), genera
   `prisma/migrations/<fecha>_<nombre>/migration.sql`, lo aplica y regenera el cliente.
3. Si el cambio necesita algo que Prisma no expresa (un CHECK, un trigger, un índice parcial), usar
   `pnpm prisma migrate dev --create-only`, agregar ese SQL al `migration.sql` generado y luego `pnpm db:migrate`.
4. Compartir la carpeta de la migración junto con el cambio de `schema.prisma`. Los demás la reciben al
   reiniciar la API en Docker (o con `pnpm db:deploy`).

Reglas:
- No editar migraciones ya aplicadas; cada cambio es una migración nueva.
- No usar `prisma db push`: cambia la base sin dejar migración y desordena el historial.

## Endpoints

| Método y ruta | Qué hace |
|---|---|
| `GET /api/health` | Comprueba que la API y la base responden |
| `GET /api/documents` | Lista los documentos de la organización (más recientes primero), con el estado de su análisis con IA (`analysisStatus`, `analysisError`, `pendingProposals`) |
| `POST /api/documents` | Sube un PDF. Formulario multipart: `file` (obligatorio) y `type` (`CV`, `JOB_PROFILE` o `SUPPORTING`; por defecto `CV`). Un CV queda en cola para el análisis con IA |
| `GET /api/documents/:id/extraction` | Estado del análisis del CV y sus competencias propuestas (pendientes de revisión) |
| `POST /api/documents/:id/extraction` | Pide analizar de nuevo un CV cuyo análisis falló (409 si ya está en curso o ya fue analizado) |
| `POST /api/documents/:id/extraction/review` | Guarda la revisión humana de las competencias propuestas, todo o nada. JSON: `employeeId` o `newEmployeeName` (obligatorio si se confirma algo) y `decisions`: `[{ proposalId, action: "confirm" \| "dismiss", name?, category?, level? }]` |
| `GET /api/documents/:id/file` | Devuelve el PDF de la última versión del documento para verlo en el navegador |
| `GET /api/departments` | Lista las áreas activas (ordenadas por nombre) |
| `GET /api/departments/:id` | Devuelve un área |
| `POST /api/departments` | Crea un área. JSON: `code` y `name` (obligatorios), `description` y `parentDepartmentId` (opcionales) |
| `PATCH /api/departments/:id` | Edita un área (solo los campos enviados). Rechaza un área superior que forme un ciclo |
| `DELETE /api/departments/:id` | Archiva el área (no la borra). Se rechaza si tiene subáreas o puestos activos |
| `GET /api/organizations` | Organizaciones donde el usuario actual es miembro activo, con personas y cargos activos. `taxId` siempre es `null` (el esquema no guarda RUT) |
| `GET /api/positions` | Lista los cargos activos con su área, cargo superior y personas asignadas hoy |
| `GET /api/positions/:id` | Devuelve un cargo |
| `POST /api/positions` | Crea un cargo. JSON: `code`, `title`, `departmentId` (obligatorios), `parentPositionId`, `targetHeadcount`, `criticality` (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`), `description` |
| `PATCH /api/positions/:id` | Edita un cargo. Rechaza un cargo superior que forme un ciclo |
| `DELETE /api/positions/:id` | Archiva el cargo. Se rechaza si tiene cargos a su cargo o personas asignadas |
| `GET /api/employees` | Lista las personas con sus cargos vigentes (sin competencias; para eso `/api/talent`) |
| `GET /api/talent` | Directorio de Talento: personas activas, cargo principal, competencias confirmadas, requisitos del cargo y ajuste calculado (`fitPercent`, `status`, `reasons`) |
| `GET /api/skills` | Catálogo de competencias activas, con cuántas personas tiene cada una |
| `GET /api/positions/:id/skills` | Requisitos de competencias del cargo |
| `PUT /api/positions/:id/skills` | Reemplaza los requisitos del cargo. JSON: `{ requirements: [{ skillId \| (name + category), requiredLevel (1–5 o null), isMandatory (true), weight (1) }] }`. Una competencia por nombre se busca en el catálogo o se crea |
| `GET /api/employees/:id` | Devuelve una persona |
| `POST /api/employees` | Crea una persona. JSON: `fullName` (obligatorio), `employeeCode`, `email`, `weeklyCapacityHours`, `status`, `positionId` (le asigna el cargo desde hoy) |
| `PATCH /api/employees/:id` | Edita una persona. `positionId` cambia su cargo: cierra la asignación anterior y abre una nueva (`null` = sin cargo) |
| `DELETE /api/employees/:id` | Archiva la persona. Se rechaza si tiene un cargo vigente |
| `POST /api/org-chart/import?mode=preview` | Revisa un CSV de organigrama y muestra qué cambiaría, **sin guardar** |
| `POST /api/org-chart/import?mode=apply` | Importa el CSV: guarda todo en una transacción o nada si hay errores |

### Importar un organigrama (CSV)

Plantilla: `docs/plantilla-organigrama.csv` (también se descarga desde la pantalla Ingesta).

| Columna | | Qué es |
|---|---|---|
| `nombre` | obligatoria | Nombre completo de la persona |
| `cargo` | obligatoria | Nombre del cargo. Un cargo es la combinación área + cargo |
| `area` | obligatoria | Área del cargo |
| `jefe_directo` | opcional | Nombre (o código) del jefe directo. Vacío para quien está más arriba |
| `codigo` | opcional | Código o RUT. Necesario si hay dos personas con el mismo nombre |

- Acepta `,` o `;` como separador y debe estar en **UTF-8** (en Excel: "CSV UTF-8 (delimitado por comas)").
- El jefe directo se guarda como jerarquía de **cargos**: el cargo de la persona queda bajo el cargo de su jefe.
  Si dos personas con el mismo cargo y área tienen jefes con cargos distintos, es un error: hay que usar nombres
  de cargo distintos (por ejemplo "Técnico senior - Turno A"). No se adivina.
- Áreas, cargos y personas que ya existen se reconocen por nombre (sin importar mayúsculas ni tildes) o código.
  Los códigos de áreas y cargos nuevos se generan a partir del nombre.
- Las personas que **no** vienen en el archivo no se archivan: el resultado las lista para que alguien decida.
- El CSV no trae fechas: las asignaciones nuevas empiezan el día de la importación (hora de Chile).

```powershell
curl.exe -F "file=@docs\plantilla-organigrama.csv" "http://localhost:3000/api/org-chart/import?mode=preview"
```

### Análisis de CVs con IA

Al subir un CV se crea una fila `QUEUED` en `extraction_runs`. Un proceso dentro de la API
(`extraction.worker.ts`) revisa la cola cada `EXTRACTION_POLL_MS` y analiza los CVs de a uno:

1. Lee el texto del PDF con `unpdf`. Si casi no tiene texto (PDF escaneado) queda en error `PDF_SIN_TEXTO`.
2. Envía el texto a Claude (`EXTRACTION_MODEL`, por defecto `claude-opus-5-5`) pidiendo un JSON fijo
   (`cv-extraction-schema.ts`): nombre de la persona y competencias con categoría, nivel y un fragmento del CV.
   Si el modelo rechaza la solicitud por sus filtros de seguridad, la API de Anthropic la reintenta con otro
   modelo (parámetro `fallbacks`).
3. Valida el JSON con Zod y **descarta** las competencias cuyo fragmento no aparece en el CV (la IA lo inventó o
   lo alteró), las repetidas y las vacías. Lo descartado queda en `structured_output.discarded` con su motivo.
4. Guarda las competencias en `skill_proposals` con estado `PENDING`. No toca `skills` ni `employee_skills`:
   solo una persona, al revisar, las convierte en datos confirmados.

**Revisión** (`proposal-review.service.ts`, pantalla `/ingesta/revision/:documentId`), en una sola transacción:

- El CV se vincula a la persona elegida (o a una nueva, creada sin cargo). Si ya estaba vinculado a otra, 409.
- Confirmar: busca la competencia en el catálogo por nombre (sin importar mayúsculas ni tildes) o la crea; crea
  `evidence` (tipo DOCUMENT, con el fragmento, la versión del CV y el análisis) y `employee_skills` como
  `DECLARED` (lo dice el CV; `VERIFIED` queda para una verificación posterior).
- Si la persona ya tenía esa competencia, **no se modifica**: la respuesta la lista en `alreadyRegistered`.
- Descartar: la propuesta queda `DISMISSED`. Las decisiones guardan quién y cuándo, más un `EXTRACTION_REVIEWED`
  en `audit_events`.
- Si una propuesta ya no está pendiente (otra persona la revisó), responde 409 y no guarda nada.

La cola es la propia base (`SELECT … FOR UPDATE SKIP LOCKED`): no hace falta Redis. Si la API se reinicia a mitad
de un análisis, a los 15 minutos vuelve a la cola (máximo 3 intentos; después queda en error `INTERRUMPIDO`).

Variables (en `api/.env`, ver `.env.example`):

| Variable | Qué es |
|---|---|
| `ANTHROPIC_API_KEY` | Clave de Claude. **Solo aquí**, nunca en el frontend ni en git. Sin clave, los CVs quedan en error `IA_NO_CONFIGURADA` |
| `EXTRACTION_MODEL` | Modelo (por defecto `claude-opus-5-5`) |
| `EXTRACTION_WORKER` | `off` deja los CVs en cola sin analizarlos |
| `EXTRACTION_POLL_MS` | Cada cuánto se revisa la cola (por defecto 5000) |

Códigos de error (`extraction_runs.error_code`): `IA_NO_CONFIGURADA`, `IA_CLAVE_INVALIDA`, `IA_NO_DISPONIBLE`,
`IA_RECHAZO`, `IA_RESPUESTA_INVALIDA`, `PDF_ILEGIBLE`, `PDF_SIN_TEXTO`, `CV_DEMASIADO_LARGO`,
`ARCHIVO_NO_ENCONTRADO`, `INTERRUMPIDO`, `ERROR_INTERNO`. El mensaje (`error_message`) está en español y no
incluye secretos.

Para cambiar de proveedor de IA: crear otra clase que cumpla `ExtractionProvider` y registrarla en
`extraction.module.ts`. Si cambia el prompt, subir `PROMPT_VERSION`; si cambia el JSON, `OUTPUT_SCHEMA_VERSION`.

**Datos personales:** el texto de cada CV se envía a Anthropic y se guarda en `extraction_runs.extracted_text`.

### Directorio de Talento y ajuste al cargo

`GET /api/talent` calcula el ajuste en cada consulta (no lo guarda) con la regla de
`src/modules/talent/fit-rules.ts` (umbrales en `FIT_RULES`):

- **Cobertura de cada requisito:** 0 si la persona no tiene la competencia; nivel actual ÷ nivel requerido (máximo
  1); 1 si el requisito no exige nivel; 0,5 si la tiene sin nivel indicado ("nivel por confirmar").
- **Ajuste** = promedio de las coberturas ponderado por el peso de cada requisito, en %.
- **Estado:** `sin-requisitos` (el cargo no tiene requisitos o la persona no tiene cargo); `critico` (falta una
  obligatoria o el ajuste es menor que 60 %); `desaprovechado` (100 % y supera en promedio el nivel requerido en 1
  o más); `optimo` (los demás). `reasons` explica el estado en español.
- Se usa el **cargo principal** (mayor dedicación y, si empatan, el más antiguo). Las competencias rechazadas o
  archivadas no cuentan.

Es una vista rápida: el diagnóstico (módulo `diagnostics`, pendiente) guardará hallazgos con su evidencia.

### Pruebas

`pnpm test` ejecuta pruebas que no necesitan base de datos ni clave de IA: lectura y validación del CSV
(`test/org-chart-csv.test.ts`) y análisis de CVs (`test/extraction.test.ts`: lectura de PDF, descarte de
fragmentos inventados, estados, validación de la revisión, catálogo y persona sugerida) y ajuste al cargo
(`test/talent.test.ts`: regla y validación de requisitos). Los endpoints todavía no tienen pruebas automáticas
contra la base.

Probar la carga desde PowerShell:

```powershell
curl.exe -F "file=@C:\ruta\a\mi-cv.pdf" http://localhost:3000/api/documents
curl.exe http://localhost:3000/api/documents
```

Reglas de la carga: solo PDF reales (se revisa el contenido, no solo la extensión), máximo 10 MB
(`MAX_UPLOAD_MB`). El archivo se guarda en disco (`STORAGE_DIR`) y se registra en `documents`,
`document_versions` y `audit_events`. Si la base falla, el archivo se borra.

**Modo demostración:** todavía no existe login. La API trabaja siempre como el OWNER de la organización
`demo` (ver `src/common/current-organization.service.ts`).

## Estructura

```
src/
  main.ts                    arranque; todas las rutas empiezan con /api
  app.module.ts              módulo raíz: aquí se registra cada módulo nuevo
  config.ts                  variables de entorno
  health.controller.ts       GET /api/health
  prisma/                    PrismaService (acceso a la base) disponible en toda la aplicación
  storage/                   FileStorageService: guarda y borra archivos en disco
  common/                    piezas compartidas: organización actual, filtro de errores,
                             validación de entradas (input.ts), fechas y asignaciones (assignments.ts)
  modules/
    organizations/           organizaciones (pantalla Hub)
    departments/             áreas
    positions/               cargos y su jerarquía
    employees/               personas y su cargo vigente (employee-assignment.ts)
    org-chart-import/        importador de organigrama desde CSV
    extraction/              análisis de CVs con IA: cola, proveedor (Claude), propuestas y su revisión
    skills/                  catálogo de competencias y requisitos por cargo
    talent/                  Directorio de Talento y regla de ajuste al cargo (fit-rules.ts)
    documents/               módulo de documentos (ejemplo a seguir)
      documents.module.ts      declara el controlador y el servicio
      documents.controller.ts  rutas HTTP; solo recibe la solicitud y llama al servicio
      documents.service.ts     lógica: validaciones, Prisma, archivos
      document-list-item.ts    forma de los datos que se devuelven al frontend
prisma/
  schema.prisma              modelo de datos (29 tablas)
  migrations/                historial de cambios de la base
  seed.ts                    datos de demostración
prisma.config.ts             configuración de la CLI de Prisma
```

## Cómo agregar un módulo nuevo

Ejemplo: un módulo `scenarios` para listar escenarios de reestructuración.

1. Crear la carpeta `src/modules/scenarios/` con tres archivos, copiando la forma de `positions` o `skills`:
   - `scenarios.controller.ts`: las rutas (`@Controller('scenarios')`, `@Get()`, `@Post()`...).
     Solo recibe los datos y llama al servicio.
   - `scenarios.service.ts`: la lógica. Usa `PrismaService` para la base y
     `CurrentOrganizationService` para saber la organización actual.
   - `scenarios.module.ts`: declara el controlador y el servicio.
2. Registrar `ScenariosModule` en `src/app.module.ts`, en la lista "Módulos de negocio".
3. Validar el cuerpo con las funciones de `src/common/input.ts`. Filtrar siempre por `organizationId` de la organización actual: nunca recibirlo desde el navegador.
4. Probar con `curl.exe http://localhost:3000/api/scenarios`.

`PrismaService`, `FileStorageService` y `CurrentOrganizationService` están disponibles en todos los
módulos sin importarlos en cada `*.module.ts`.
