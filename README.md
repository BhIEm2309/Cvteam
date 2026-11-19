# Diagnóstico Organizacional Inteligente

Plataforma para diagnosticar la estructura organizacional real de una empresa a partir de CVs y perfiles de cargo.

| Carpeta | Contenido |
|---|---|
| `frontend/` | React 19 + Vite 7 + TypeScript, Tailwind CSS 4, shadcn/ui, TanStack Query, React Router, Zod |
| `api/` | NestJS 11 + TypeScript, Prisma 6 (esquema, migraciones y datos de demostración en `api/prisma/`) |
| `DB/` | SQL de origen del esquema (28 tablas) y pruebas de integridad |
| `docs/` | Diseño de la base de datos |

## Levantar el proyecto

Único requisito: [Docker Desktop](https://www.docker.com/products/docker-desktop/) abierto.

```powershell
docker compose up --build
```

La primera vez tarda unos minutos (descarga imágenes e instala dependencias). Después:

| Servicio | Dirección |
|---|---|
| Frontend | http://localhost:5173 |
| API | http://localhost:3000/api/health → `{"status":"ok"}` |
| PostgreSQL | `localhost:5433` · base `diagnostico` · usuario `diagnostico` · clave `diagnostico_dev` |

Al guardar un archivo en `frontend/src` o `api/src`, la aplicación se recarga sola.
El frontend llama a la API con rutas `/api/...`; Vite las reenvía al contenedor de la API.

## Estado del proyecto (avance al 14-11-2026)

### Funciona de verdad (frontend + API + base de datos)

- **Ingesta de CVs** (http://localhost:5173/ingesta): subir uno o varios PDF (arrastrando o seleccionando),
  elegir el tipo (CV, perfil de cargo, documento de apoyo), ver el avance, la lista de documentos guardados,
  el resumen y abrir cada PDF con el botón "Ver".
- Validaciones en el navegador y en la API: solo PDF reales, máximo 10 MB, mensajes en español.
- Cada carga queda registrada en `documents`, `document_versions` y `audit_events`; los archivos se guardan
  en el volumen `storage` de Docker.
- **Análisis de CVs con IA**: al subir un CV, la API lo analiza en segundo plano con Gemini (plan gratis de Google;
  Claude es configurable) y guarda sus competencias como **propuestas** pendientes de revisión. Necesita
  `GEMINI_API_KEY` en `api/.env`. Con Gemini gratis, **solo CVs de prueba**: Google puede usar lo enviado
  (ver `api/README.md`, "Análisis de CVs con IA").
- **Revisión de competencias** (`/ingesta/revision/:documentId`, enlace "Revisar" en cada CV analizado): una
  persona elige a quién pertenece el CV y confirma o descarta cada competencia. Solo lo confirmado queda
  registrado (`skills`, `employee_skills`, `evidence`).
- **Directorio de Talento** (`/directorio`): competencias confirmadas de cada persona, requisitos de cada cargo
  (se definen en el panel de perfil) y ajuste al cargo calculado con una regla explicable
  (`api/src/modules/talent/fit-rules.ts`). Sin requisitos definidos, el ajuste no se calcula.
- **Hub** (`/hub`): organizaciones del usuario con sus totales de personas y cargos (`GET /api/organizations`).
  Sin login, muestra solo la "Empresa Demo".
- **Importar organigrama** (tarjeta en Ingesta): CSV con nombre, cargo, área, jefe directo y, opcional, dotación
  objetivo. Primero se revisa sin guardar; luego se confirma.
- Base de datos completa (29 tablas) creada por las migraciones de Prisma, con datos de demostración.
- **Laboratorio, estructura actual** (`/laboratorio`): árbol de cargos con las personas asignadas hoy y las
  vacantes según la dotación objetivo (`GET /api/positions/org-chart`).

### Solo interfaz, con datos de ejemplo

Se muestran con un aviso amarillo y toman sus datos de `frontend/src/features/<pantalla>/mock.ts`:

- **Laboratorio, estructura propuesta**: todavía no existen el diagnóstico ni los escenarios.
- Cualquier pantalla, cuando la API no responde (modo `auto`) o con `VITE_DATA_MODE=mock`.

### Limitaciones actuales

- **No hay login.** La API trabaja siempre como el OWNER de la "Empresa Demo"
  (`api/src/common/current-organization.service.ts`). Está pensado para reemplazarse por Supabase Auth.
- Los perfiles de cargo todavía no se analizan: los requisitos de cada cargo se definen a mano.
- Solo se aceptan PDF (no Word).

### Claves de API (seguridad)

- Las claves (`ANTHROPIC_API_KEY`, `GEMINI_API_KEY`) van **solo** en `api/.env`, que git ignora. Nunca en el
  frontend, en el repositorio, en capturas ni en mensajes.
- Durante el prototipo, la clave de Gemini se compartió en un chat. Se aceptó porque es una clave gratuita de
  desarrollo, usada solo con CVs de prueba.
- **Antes de pasar a producción (si se sube): borrar las claves de desarrollo y crear claves nuevas** en la consola
  de cada proveedor (Google AI Studio, consola de Anthropic). Hacer lo mismo cada vez que una clave quede a la vista.

### Próximos pasos sugeridos

1. **Perfiles de cargo con IA**: funciones esperadas (`responsibilities`) y requisitos de competencias propuestos
   para revisión.
2. **Diagnóstico** con hallazgos guardados y su evidencia (`findings`, `finding_evidence`).
3. **Escenarios** en el Laboratorio (estructura propuesta con `scenarios`).
4. **Login** con Supabase Auth reemplazando `CurrentOrganizationService`.

Guías para agregar código: "Cómo agregar un módulo nuevo" en [api/README.md](api/README.md) y
"Cómo agregar una página" en [frontend/README.md](frontend/README.md).

## Comandos frecuentes

```powershell
docker compose up --build -d     # levantar en segundo plano
docker compose logs -f api       # ver registros (api, frontend o db)
docker compose down              # apagar (conserva los datos)
docker compose down -v           # apagar y BORRAR la base; al volver a levantar se recrea con las migraciones
docker compose up --build -V     # después de agregar o actualizar dependencias (package.json)
```

**Agregar una dependencia:** editarla con `pnpm add <paquete>` dentro de `frontend/` o `api/` (requiere Node y pnpm),
o ejecutarlo en el contenedor: `docker compose exec frontend pnpm add <paquete>`. Luego `docker compose up --build -V`.

## Base de datos

- La estructura la manejan las **migraciones de Prisma** (`api/prisma/migrations/`). Al iniciar, la API aplica
  las pendientes y carga los datos de demostración ("Empresa Demo" y un usuario OWNER, `api/prisma/seed.ts`).
- Para cambiar la base: editar `api/prisma/schema.prisma` y ejecutar `docker compose exec api pnpm db:migrate`
  (o `pnpm db:migrate` dentro de `api/`). Detalles y reglas en [api/README.md](api/README.md).
- Diseño completo: [docs/diseno-base-de-datos.md](docs/diseno-base-de-datos.md) · restricciones y pruebas: [DB/README.md](DB/README.md).

## Trabajar sin Docker (opcional)

Con Node 22+ y pnpm 10 se puede ejecutar cada aplicación en el equipo, manteniendo solo la base en Docker
(`docker compose up -d db`). Ver `frontend/README.md` y `api/README.md`.

## Compartir el proyecto

Al comprimir o copiar la carpeta, excluir `node_modules/` y `dist/` de `frontend/` y `api/`, `api/.env` y
`api/storage/`: se regeneran solos. Para crear un repositorio git, el `.gitignore` ya excluye esos archivos.
