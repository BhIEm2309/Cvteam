# Avance del proyecto: Diagnóstico Organizacional Inteligente

Fecha: 12 de noviembre de 2026.

Este documento resume lo que está hecho, cómo está organizado y qué falta. Los detalles de cada parte están
en los README de cada carpeta.

## 1. Cómo levantarlo

Solo se necesita **Docker Desktop** abierto. Dentro de la raíz del repositorio (`Cvteam`):

```powershell
docker compose up --build
```

La primera vez tarda unos minutos. Después:

| Servicio | Dirección |
|---|---|
| Frontend | http://localhost:5173 |
| API | http://localhost:3000/api/health → `{"status":"ok"}` |
| PostgreSQL | `localhost:5433` · base `diagnostico` · usuario `diagnostico` · clave `diagnostico_dev` |

Al guardar archivos en `frontend/src` o `api/src`, la aplicación se recarga sola.

## 2. Stack

| Parte | Tecnología |
|---|---|
| Frontend | React 19, Vite 7, TypeScript, Tailwind CSS 4, shadcn/ui, TanStack Query, React Router 7, Zod |
| Backend | NestJS 11, TypeScript 5.9, Prisma 6 |
| Base de datos | PostgreSQL 17 |
| Entorno | Docker Compose (base, API y frontend), Node 22, pnpm 10 |

## 3. Estructura de carpetas

```
Cvteam/
  docker-compose.yml   levanta base, API y frontend
  README.md            guía general y estado del proyecto
  docs/                diseño de la base de datos y este documento
  DB/                  SQL de origen y script de pruebas de integridad
  api/                 backend NestJS + Prisma
  frontend/            frontend React
```

## 4. Base de datos

- **Diseño:** 28 tablas, descritas en `docs/diseno-base-de-datos.md`. Cubren empresas, usuarios, áreas,
  puestos, trabajadores, funciones, competencias, documentos, extracciones, evidencia, diagnósticos,
  recomendaciones, escenarios, alertas y auditoría.
- **Prisma la maneja por completo:**
  - `api/prisma/schema.prisma` describe las 28 tablas (nombres en camelCase mapeados a los nombres reales
    en snake_case).
  - `api/prisma/migrations/` contiene la migración inicial con el esquema completo, incluidas las reglas
    que Prisma no puede expresar: CHECK, exclusión de fechas solapadas, índices parciales y triggers.
  - `api/prisma/seed.ts` crea los datos de demostración: la "Empresa Demo" y un usuario OWNER.
- **Al iniciar Docker,** la API aplica las migraciones pendientes y carga los datos de demostración.
- **Integridad:** la base impide mezclar datos de empresas distintas y asignaciones con fechas solapadas,
  entre otras cosas. `DB/002_verificar_integridad.sql` lo prueba.
- **Para cambiar la base:** editar `schema.prisma` y ejecutar `pnpm db:migrate` dentro de `api/`.
  No usar `prisma db push`. Detalles en `api/README.md`.

## 5. Backend (API)

Todas las rutas empiezan con `/api`.

| Ruta | Qué hace |
|---|---|
| `GET /api/health` | Comprueba que la API y la base respondan |
| `GET /api/documents` | Lista los documentos subidos |
| `POST /api/documents` | Sube un PDF (campo `file`) con su tipo (`type`: CV, JOB_PROFILE o SUPPORTING) |
| `GET /api/documents/:id/file` | Abre el PDF en el navegador |
| `GET /api/departments` | Lista las áreas activas |
| `GET /api/departments/:id` | Devuelve un área |
| `POST /api/departments` | Crea un área (`code`, `name`, `description`, `parentDepartmentId`) |
| `PATCH /api/departments/:id` | Edita un área |
| `DELETE /api/departments/:id` | Archiva un área (no la borra) |

**Documentos:**
- Solo acepta PDF reales: revisa el contenido, no solo la extensión.
- Máximo 10 MB. Acepta nombres de archivo con tildes.
- El archivo se guarda en un volumen de Docker y se registra en `documents`, `document_versions` y
  `audit_events`.

**Áreas:**
- Rechaza códigos repetidos y áreas superiores que no existen.
- Un área no puede ser su propia área superior.
- No se puede archivar un área que tiene subáreas o puestos activos.

Todos los cambios quedan registrados en `audit_events`, y los mensajes de error están en español.

**Organización del código:** `api/src/modules/<módulo>/`, cada uno con su controller (rutas), service
(lógica) y module. La sección "Cómo agregar un módulo nuevo" de `api/README.md` explica cómo crear uno
siguiendo `documents` y `departments` como ejemplo.

## 6. Frontend

Tema oscuro azul marino. Se adapta a celular, tablet y escritorio.

| Pantalla | Estado |
|---|---|
| **Ingesta de CVs** (`/ingesta`) | **Conectada a la API.** Arrastrar o seleccionar varios PDF, elegir el tipo, ver el avance de cada subida, la tabla de documentos guardados, el resumen y abrir cada PDF con "Ver" |
| **Hub** (`/hub`) | Datos de ejemplo. Tarjetas de organizaciones con búsqueda y filtro por sector |
| **Directorio de Talento** (`/directorio`) | Datos de ejemplo. Indicadores, filtros, tabla de personas y perfil con gráfico de radar |
| **Laboratorio** (`/laboratorio`) | Datos de ejemplo. Organigrama actual vs. propuesto, con pestañas y leyenda |

Las pantallas con datos de ejemplo muestran un aviso amarillo. Sus datos están en `frontend/src/features/<pantalla>/mock.ts` y
son empresas y personas ficticias.

**Organización del código:** una carpeta por pantalla en `src/features/<pantalla>/` (página, `components/`,
`api.ts`, `mock.ts`) y lo común en `src/shared/`. La sección "Cómo agregar una página" de
`frontend/README.md` explica cómo crear una.

## 7. Limitaciones actuales

- **No hay login.** La API trabaja siempre como el OWNER de la "Empresa Demo"
  (`api/src/common/current-organization.service.ts`). Está pensado para reemplazarse por Supabase Auth
  cambiando solo ese archivo.
- La IA todavía no analiza los CVs: todos quedan como "Pendiente de análisis".
- Solo se aceptan PDF, no Word.
- El CRUD de áreas no tiene pantalla en el frontend todavía.

## 8. Próximos pasos sugeridos

1. Pantalla "Áreas" en el frontend, usando la API que ya existe.
2. CRUD de puestos (`positions`) y trabajadores (`employees`), siguiendo el módulo de áreas.
3. Conectar el Hub y el Directorio a datos reales.
4. Extracción de habilidades con IA (`extraction_runs`, `skills`, `employee_skills`).
5. Organigrama real en el Laboratorio a partir de `positions`.
6. Login con Supabase Auth.
7. Pruebas automáticas (Jest + Supertest).

## 9. Cuidados

- Al compartir la carpeta, excluir `node_modules/`, `dist/`, `api/.env` y `api/storage/`. El `.gitignore`
  ya los excluye para cuando se cree el repositorio.
- Después de agregar dependencias, levantar con `docker compose up --build -V`.
- `docker compose down -v` borra la base y los archivos subidos. Al volver a levantar, la base se recrea
  desde cero.
