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

### Lista de verificación de Docker (recorrida el 21-11-2026: 13 de 14; ver problema 3)

Para quien tenga Docker Desktop. Anotar el resultado de cada punto en la sección 6 (problema 3).

1. `docker compose version` → 2.24 o superior (necesario para `env_file` con `required: false`).
2. Copiar `api/.env.example` a `api/.env` y poner `GEMINI_API_KEY` (gratis, Google AI Studio). `git status` **no** debe
   mostrar `api/.env`.
3. En la raíz: `docker compose up --build`. Termina sin errores y el registro de la API dice
   "Análisis de CVs activo (Gemini, modelo gemini-3.5-flash-lite)" y **no** "Falta GEMINI_API_KEY".
4. `docker compose exec api node --version` → v22.12 o superior (cargar `unpdf` con `require` lo necesita).
5. La clave llega sin mostrarla: `docker compose exec api sh -c 'test -n "$GEMINI_API_KEY" && echo clave-presente'`
   → `clave-presente`. Y `docker compose exec api printenv EXTRACTION_PROVIDER` → `gemini`.
6. `docker compose exec api printenv DATABASE_URL` → apunta a `@db:5432` (no a `localhost:5433` de `api/.env`).
7. http://localhost:3000/api/health → `{"status":"ok"}`. El frontend (http://localhost:5173) dice "Conectado".
8. `docker compose exec api pnpm db:status` → 3 migraciones aplicadas.
9. `docker compose exec api pnpm test` y `docker compose exec api pnpm test:integration` → todo pasa.
10. Ingesta: subir un CV real (PDF con texto) → "En cola" → "Analizado" con competencias por revisar. En la
    revisión aparece "Analizado con gemini-3.5-flash-lite". Anotar el tiempo y si las competencias tienen sentido.
    Con Gemini gratis usar **solo CVs de prueba** (ver problema 8).
11. Subir un PDF escaneado (imagen) → "Error" con el mensaje de PDF sin texto.
12. Importar `docs/plantilla-organigrama.csv` → el Hub muestra 4 personas y 3 cargos; el Laboratorio muestra
    "Técnico senior" con 2 personas, dotación 3 y 1 vacante.
13. Revisar el CV y confirmar competencias para una persona; en el Directorio definir requisitos de su cargo → aparece el ajuste.
14. `docker compose restart api` → los datos y los PDF siguen ahí.

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

## 5. Estado actual (19-11-2026)

- Real: Ingesta de CVs (subir PDF, listar, ver) con análisis de competencias por IA (paso 5a). API de áreas
  (`/api/departments`) sin pantalla.
- Frontend organizado por pantallas (`app/`, `shared/`, `features/<pantalla>/`) con modo de datos
  `auto`/`api`/`mock` implementado. La barra superior muestra la fuente real de cada pantalla.
- Backend etapa B escrito (paso 4): `organizations` (Hub), `positions`, `employees` e importador de
  organigrama CSV (`POST /api/org-chart/import?mode=preview|apply`, con tarjeta en Ingesta).
  Probado contra PostgreSQL 17 en memoria (PGlite, sin Docker) el 13-11-2026: importar, reimportar sin duplicar,
  cambio de cargo, archivado y ciclos. La lectura y validación del CSV tiene pruebas (`pnpm test` en `api/`).
  Desde el 14-11-2026 guarda la dotación objetivo de cada cargo (columna opcional `dotacion_objetivo`; si no viene,
  la cantidad de personas del archivo).
- IA (paso 5a): al subir un CV se encola su análisis (`extraction_runs`). Un proceso en segundo plano lo lee
  (`unpdf`), lo envía a la IA y guarda las competencias en `skill_proposals` como **propuestas** (PENDING).
  Ingesta muestra el estado (En cola / Analizando / Analizado / Error) y permite "Analizar de nuevo".
  Desde el 19-11-2026 el proveedor por defecto es **Gemini** (`gemini-3.5-flash-lite`, plan gratis de Google, costo 0)
  y Claude queda configurable (`EXTRACTION_PROVIDER=claude`). Con Claude, si el error es `IA_RECHAZO` se destaca
  "Analizar con Claude Sonnet 5.5"; con Gemini ese botón no aparece (`GET /api/extraction/settings`).
  Gemini probado con la API real el 19-11-2026: 3 CVs inventados, 82 de 82 citas pasaron el filtro literal, y de punta
  a punta en el navegador (subir → Analizado → revisión). Claude **nunca se probó con la API real**.
- Revisión humana (paso 5b): página `/ingesta/revision/:documentId`. Quien revisa elige la persona (o la crea),
  corrige nombre, categoría y nivel, y confirma o descarta. Confirmar crea `skills` (si no existe), `evidence` y
  `employee_skills` (DECLARED) en una transacción; una competencia que la persona ya tenía no se modifica.
  Probado con PGlite y en el navegador.
- Directorio de Talento real (`/api/talent`): competencias confirmadas, requisitos por cargo (`/api/skills`,
  `/api/positions/:id/skills`, editables en el panel de perfil) y ajuste calculado con la regla explicable de
  `api/src/modules/talent/fit-rules.ts` (sin requisitos no hay ajuste). Probado con PGlite y en el navegador.
- Laboratorio, estructura actual real (14-11-2026): `GET /api/positions/org-chart` (cargos, personas de hoy y
  vacantes; cuenta personas, no jornadas; reglas en `api/src/modules/positions/org-chart.ts`) y árbol
  `PositionTree`. Probado con PGlite y en el navegador. Hub usa la API real cuando responde.
- Ajuste persona-cargo y estructura propuesta (19-11-2026, sin IA):
  - Organigrama CSV: una fila **sin nombre** declara un cargo vacante (rol faltante).
  - Perfiles de cargo por CSV (`POST /api/position-profiles/import`, tarjeta en Ingesta), además de la edición a mano.
  - Revisión del CV: cada propuesta indica si ya está en el catálogo o a cuál se parece (`skills/skill-similarity.ts`,
    sin IA); quien revisa decide si usa ese nombre. El ajuste sigue cruzando por nombre exacto.
  - Estado "Ajuste parcial" (60 a 84 %); "Óptimo" desde 85 % (`FIT_RULES.optimalFromPercent`).
  - Módulo `diagnostics`: `POST /api/diagnostics` aplica `diagnostic-rules.ts` (vacantes, desajuste, talento
    desaprovechado, reasignaciones hacia vacantes, datos faltantes) y lo guarda en `diagnostic_runs`, `findings`,
    `finding_evidence` y `recommendations`. Si los datos no cambiaron, no se duplica. Aceptar o rechazar una
    recomendación solo registra la decisión.
  - Laboratorio, estructura propuesta: datos del último diagnóstico. "Funciones ajenas" sigue como ejemplo con aviso.
  - Probado con PGlite (pruebas) y en el navegador con datos inventados y el Gemini **simulado**. **No** se probó con
    `organigrama_compresores_del_sur.csv` ni con los CVs de Valentina y Matías: esos archivos no estaban en el equipo.
- No existe: login, pantalla del catálogo de habilidades, perfiles de cargo con IA, escenarios, encuesta de funciones.
- Base de datos: 29 tablas (28 del diseño + `skill_proposals`, paso 5) en 3 migraciones (`docs/diseno-base-de-datos.md`).
  La tercera (19-11-2026) solo agrega el tipo de hallazgo `UNDERUSED_TALENT` ("Talento desaprovechado").
- Nombre visible: "Organigrama Vivo" (nombre de trabajo), centralizado en `frontend/src/shared/lib/brand.ts`.
- Pasos 1 a 5 de la sección 9 completados (5a: análisis con IA; 5b: revisión humana).
- Pruebas: `pnpm test` (110, sin base) y `pnpm test:integration` (31, API completa con PGlite y las API de Anthropic y
  Gemini simuladas, ~30 s) en `api/`. Las pruebas nunca llaman a una IA real (reemplazan las claves de `api/.env`).

## 6. Problemas conocidos (pendientes)

1. El organigrama de ejemplo suma ~46 personas (1 + 1 + 8 + 34 + 1 + 1) y Figma dice 62 colaboradores.
   Confirmar con el diseño si hay personal fuera del organigrama.
2. El diseño de Figma menciona "PDF o Word"; la API y la interfaz solo aceptan PDF. Corregir en Figma
   (o decidir soportar Word, que sería una funcionalidad nueva).
3. **Docker: lista de verificación recorrida el 21-11-2026, 13 de 14 puntos pasan** (Docker 29.9.3, Compose v5.7.0,
   Node v22.23.5 en el contenedor, Gemini con clave nueva). Detalle:
   - 1–8, 12 y 14 pasan: la API dice "Análisis de CVs activo (Gemini, modelo gemini-3.5-flash-lite)", la clave llega
     sin mostrarse, `DATABASE_URL` apunta a `@db:5432`, 3 migraciones aplicadas, el frontend dice "Conectado", el
     organigrama de la plantilla da "Técnico senior" con 2 personas, dotación 3 y 1 vacante, y tras
     `docker compose restart api` siguen los datos y los PDF.
   - 10 pasa: un CV **inventado** (texto, con RUT, correo, teléfono y dirección falsos) quedó "Analizado" en ~14 s, sin
     503, con 9 competencias razonables, 0 descartadas por el filtro de citas y los 4 datos personales ocultados.
     Gemini puso nivel 5 a "Mantención de compresores" (alto, ver problema 9c) y convirtió "Atención al cliente en
     terreno" en "Comunicación efectiva" (no cuenta para un perfil que pide "Atención al cliente", ver problema 12).
   - 11 pasa: un PDF solo imagen queda en error `PDF_SIN_TEXTO`.
   - 13 pasa: con el CV confirmado para Luis Vega y el requisito "Mantención de compresores" (nivel 3, obligatoria) en
     "Técnico senior", el Directorio muestra 100 % "Talento desaprovechado".
   - **9 falla en parte:** dentro del contenedor `pnpm test` pasa (108 y 2 saltadas a propósito), pero
     `pnpm test:integration` da 25 de 31: el contenedor solo monta `api/` y las pruebas leen
     `docs/plantilla-organigrama.csv` (falla la prueba 2 y, en cadena, 3, 4, 5, 14 y 15). En el equipo pasan las 31.
     Falta decidir: montar `docs/` en Docker, que la prueba se salte sin `docs/` (como las unitarias) o cambiar este
     punto de la lista.
   - Si los contenedores son anteriores a una migración o a un cambio de dependencias, recrearlos con
     `docker compose up -d --build -V` (`-V` renueva `node_modules`; la base y los PDF se conservan). Con un contenedor
     del 14-11 la API no arrancaba (cliente Prisma sin `UNDERUSED_TALENT`).
4. Con `VITE_DATA_MODE` inválido la app se detiene y el error solo aparece en la consola (página en blanco).
5. El esquema no guarda RUT de la organización: `taxId` siempre es `null` (requiere una migración).
6. Hub con la API real muestra solo "Empresa Demo" (sin login, el usuario pertenece a una organización).
7. Al reimportar un organigrama, la dotación objetivo del archivo (declarada o, si no viene, la cantidad de
   personas) **reemplaza** la de la base, aunque alguien la haya ajustado a mano con `PATCH /api/positions/:id`.
   La vista previa lo muestra ("Cargos que cambian de dotación objetivo") antes de confirmar. Si molesta, la
   alternativa es actualizarla solo cuando el archivo trae `dotacion_objetivo`.
8. **Datos personales:** los CVs se envían a un servicio externo (Google con Gemini; Anthropic con Claude).
   **Gemini gratis puede usar lo enviado para mejorar sus productos y personas pueden revisarlo; sus términos piden no
   enviar información personal: con Gemini gratis, solo CVs de prueba.** Con CVs reales volver a evaluar (Gemini
   pagado, Claude o un modelo local con Ollama). Antes de usarlo con clientes reales
   hace falta su consentimiento y revisar la ley chilena de datos personales (19.628, reemplazada por la 21.719).
   El texto de cada CV queda guardado en `extraction_runs.extracted_text` (falta definir cuánto tiempo).
   Desde el 13-11-2026 se ocultan RUT, correo, teléfono y dirección antes de enviar el texto a la IA y solo se guarda
   el texto ocultado (`redact.ts`). Es parcial: el nombre se sigue enviando y hay formatos que se escapan (lista en
   `api/README.md`, "Datos personales"). Falta probarlo con CVs reales.
9. Gemini gratis (probado el 19-11-2026 con CVs inventados): (a) la mitad de las llamadas recibió 503 "alta demanda";
   ahora se reintenta a los 5, 15 y 45 s y, si sigue, queda `IA_NO_DISPONIBLE` con "Analizar de nuevo";
   (b) el mismo CV dio 7, 14, 11 y 8 competencias en 4 corridas (la API no expone temperatura): en una demo, dos
   análisis del mismo CV pueden diferir; (c) Flash-Lite exagera a veces el nivel (lo corrige quien revisa);
   (d) en un CV a dos columnas omitió competencias. El límite gratis exacto solo se ve en la cuenta (AI Studio).
   Claude no se ha probado con la API real. Con `claude-haiku-5-5` **no hay respaldo automático en el servidor**: si Haiku rechaza un
   CV por sus filtros de seguridad, queda en error `IA_RECHAZO` (con `claude-sonnet-5-5` el respaldo sí actúa).
   Verificado en la documentación oficial (`refusals-and-fallback`). Desde el 14-11-2026 quien revisa puede analizar
   de nuevo ese CV con `claude-sonnet-5-5` (botón en Ingesta). Comparar calidad de Haiku vs. Sonnet con CVs reales.
10. Un CV analizado no se puede volver a analizar (la API responde 409) para no duplicar propuestas. Las
    decisiones de la revisión no se pueden deshacer desde la pantalla (quedan en la auditoría).
11. Dos revisiones simultáneas del mismo CV: la segunda recibe 409 y no guarda nada. Se probó con PGlite, que
    ejecuta las consultas de a una; falta probarlo con PostgreSQL real y conexiones paralelas. Lo mismo vale para
    `pnpm test:integration`: no prueba concurrencia real.
12. Competencias equivalentes con distinto nombre ("SAP PM" y "SAP Plant Maintenance") quedan separadas en el
    catálogo. Desde el 19-11-2026 la revisión del CV sugiere la del catálogo, pero si quien revisa no la usa, no
    cuenta para el ajuste. Unir las ya creadas requiere una pantalla de catálogo (no existe).
13. El Directorio usa solo el cargo principal de cada persona (mayor dedicación); una persona con dos cargos se
    evalúa contra uno solo.
14. Los requisitos de cada cargo se definen a mano o con el CSV de perfiles. Ningún cargo los tiene al importar un
    organigrama, y en el CSV de organigrama nadie puede tener como jefe directo a un cargo vacante (el jefe es una persona).
15. El organigrama actual cuenta personas, no jornadas: una persona al 50 % ocupa un puesto completo de la dotación,
    y una persona con dos cargos aparece en ambos. Si la dotación debe medirse en jornadas, cambiar `org-chart.ts`.
    Con muchos cargos el árbol se desplaza a lo ancho (no hay zoom ni se pueden plegar ramas).

Resuelto el 14-11-2026: el importador ya no deja todos los cargos con `targetHeadcount = 1` (antes problema 7).

Resueltos el 13-11-2026 (después del paso 5): `extraction_runs.model` guarda el modelo que respondió y la
revisión muestra si fue distinto del pedido; `effort`, el beta `server-side-fallback-2026-07-01` y
`fallbacks: "default"` verificados en la documentación oficial; las pruebas con PGlite están en el repo
(`pnpm test:integration`); la API en Docker recibe `api/.env` de forma explícita (`env_file`).

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

16. **Inconsistencia Directorio ↔ diagnóstico:** una persona con cargo con requisitos pero **sin competencias
    confirmadas** aparece en el Directorio como "Desajuste crítico" (ajuste 0 %), mientras el diagnóstico la marca
    como "Sin competencias confirmadas" (falta información). No se cambió el Directorio sin preguntar.
17. Diagnóstico v1: solo propone reasignaciones **hacia cargos con vacantes**; no propone intercambios ni cargos nuevos.
    No detecta funciones ajenas (necesita la encuesta, paso 6). Aceptar una recomendación no asigna el cargo. No se
    probó con una segunda organización (sin login, la API trabaja siempre con la "Empresa Demo").
18. La revisión del CV sugiere la persona solo si su nombre coincide **exacto** con el que detectó la IA
    (`extraction.service.ts`). Un CV con dos apellidos ("Luis Vega Contreras") no sugiere a "Luis Vega" del
    organigrama: quien revisa la elige a mano (visto el 21-11-2026).

## 7. Estructura objetivo

### Backend (ya está bien): un módulo por funcionalidad

```
api/src/modules/<modulo>/   <modulo>.controller.ts · <modulo>.service.ts · <modulo>.module.ts · tipos
```

Módulos existentes: `documents`, `departments`, `organizations`, `positions`, `employees`, `org-chart-import`,
`extraction`, `skills`, `talent`, `diagnostics`. Próximo: `scenarios`. Validación de entradas en `src/common/input.ts`.

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
2. Texto → IA según `EXTRACTION_PROVIDER`, con el mismo prompt (`cv-extraction-prompt.ts`) y salida estructurada
   según `cv-extraction-schema.ts`: **Gemini** por defecto (`gemini-extraction.provider.ts`, `GEMINI_MODEL`, por
   defecto `gemini-3.5-flash-lite`, con reintentos ante 503/429) o **Claude** (`claude-extraction.provider.ts`,
   `CLAUDE_MODEL`, por defecto `claude-haiku-5-5`, alternativa `claude-sonnet-5-5` y respaldo si el modelo rechaza).
3. Validar con Zod y descartar competencias cuyo fragmento citado no aparece en el CV (`proposals.ts`).
   Antes del paso 2 se ocultan RUT, correo, teléfono y dirección (`redact.ts`); la IA, la verificación de
   fragmentos y `extracted_text` usan ese texto ocultado.
4. Guardar en `extraction_runs` y las competencias en `skill_proposals` (PENDING). **No** se escribe en
   `employee_skills`: esa tabla no tiene estado "pendiente" y su UNIQUE impide convivir con datos confirmados.
5. Estado: En cola → Analizando → Analizado / Error. La cola es la propia tabla (`FOR UPDATE SKIP LOCKED`), sin
   Redis/BullMQ. El frontend consulta cada 3 s mientras haya CVs en curso.
6. Revisión (paso 5b, `proposal-review.service.ts`): `POST /api/documents/:id/extraction/review`. Confirmar =
   vincular el CV a la persona y crear `skills` (por nombre normalizado), `evidence` (DOCUMENT) y `employee_skills`
   (DECLARED); descartar = DISMISSED. Una `employee_skills` existente nunca se modifica. Siempre una persona decide.

- CVs → competencias (`skills`, `employee_skills`). Perfiles de cargo → funciones esperadas (`responsibilities`).
- El diagnóstico (cruce entre funciones esperadas, funciones reales y competencias) se hace con **reglas
  explicables** guardando su evidencia (`findings`, `finding_evidence`), no con IA. Versión 1 (19-11-2026):
  `api/src/modules/diagnostics/diagnostic-rules.ts` cruza dotación y competencias; las funciones reales vendrán con
  la encuesta.
- El proveedor de IA va detrás de una interfaz (`ExtractionProvider`); `extraction.module.ts` elige la clase según
  `EXTRACTION_PROVIDER`. Un modelo local (Ollama) sería otra clase más.

## 9. Orden de trabajo

1. Reorganizar el frontend por pantallas (solo mover archivos y ajustar imports; la interfaz no cambia).
2. Modo de datos `auto`/`api`/`mock`, indicador en la barra superior, pasar las 4 pantallas a `api.ts` + `mock.ts`.
3. Limpieza: problemas conocidos de la sección 6.
4. Backend etapa B: `organizations`, `positions`, `employees` + importador de organigrama desde CSV
   (nombre, cargo, área, jefe directo).
5. IA de extracción (sección 8). 5a (backend + estados en Ingesta) y 5b (revisión humana) hechos.
6. Encuesta de funciones reales (puede quedar con datos de ejemplo para la entrega).
