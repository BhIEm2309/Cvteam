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

- `prisma/schema.prisma` describe las 28 tablas, ordenadas según las secciones de
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
| `GET /api/documents` | Lista los documentos de la organización (más recientes primero) |
| `POST /api/documents` | Sube un PDF. Formulario multipart: `file` (obligatorio) y `type` (`CV`, `JOB_PROFILE` o `SUPPORTING`; por defecto `CV`) |
| `GET /api/documents/:id/file` | Devuelve el PDF de la última versión del documento para verlo en el navegador |
| `GET /api/departments` | Lista las áreas activas (ordenadas por nombre) |
| `GET /api/departments/:id` | Devuelve un área |
| `POST /api/departments` | Crea un área. JSON: `code` y `name` (obligatorios), `description` y `parentDepartmentId` (opcionales) |
| `PATCH /api/departments/:id` | Edita un área (solo los campos enviados) |
| `DELETE /api/departments/:id` | Archiva el área (no la borra). Se rechaza si tiene subáreas o puestos activos |

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
  common/                    piezas compartidas: organización actual, filtro de errores
  modules/
    documents/               módulo de documentos (ejemplo a seguir)
      documents.module.ts      declara el controlador y el servicio
      documents.controller.ts  rutas HTTP; solo recibe la solicitud y llama al servicio
      documents.service.ts     lógica: validaciones, Prisma, archivos
      document-list-item.ts    forma de los datos que se devuelven al frontend
prisma/
  schema.prisma              modelo de datos (28 tablas)
  migrations/                historial de cambios de la base
  seed.ts                    datos de demostración
prisma.config.ts             configuración de la CLI de Prisma
```

## Cómo agregar un módulo nuevo

Ejemplo: un módulo `employees` para listar trabajadores.

1. Crear la carpeta `src/modules/employees/` con tres archivos, copiando la forma de `documents`:
   - `employees.controller.ts`: las rutas (`@Controller('employees')`, `@Get()`, `@Post()`...).
     Solo recibe los datos y llama al servicio.
   - `employees.service.ts`: la lógica. Usa `PrismaService` para la base y
     `CurrentOrganizationService` para saber la organización actual.
   - `employees.module.ts`: declara el controlador y el servicio.
2. Registrar `EmployeesModule` en `src/app.module.ts`, en la lista "Módulos de negocio".
3. Filtrar siempre por `organizationId` de la organización actual: nunca recibirlo desde el navegador.
4. Probar con `curl.exe http://localhost:3000/api/employees`.

`PrismaService`, `FileStorageService` y `CurrentOrganizationService` están disponibles en todos los
módulos sin importarlos en cada `*.module.ts`.
