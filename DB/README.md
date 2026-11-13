# Base de datos

**La base la crean y la modifican las migraciones de Prisma**, en `api/prisma/migrations/`. Esta carpeta conserva el SQL de origen y las pruebas de integridad.

| Archivo | Uso |
|---|---|
| `001_schema.sql` | Esquema original (28 tablas, 18 enumeraciones, FK, índices, CHECK, exclusiones y triggers). Es el contenido de la migración inicial `20261112230000_init`. **Ya no se ejecuta directamente ni se edita.** |
| `002_verificar_integridad.sql` | Pruebas de las restricciones sobre una base ya creada. Termina con ROLLBACK: no deja datos. |

El diseño de campos y relaciones está en [diseno-base-de-datos.md](../docs/diseno-base-de-datos.md).

## Cómo se crea la base

Al iniciar la API en Docker se ejecutan `prisma migrate deploy` (aplica las migraciones pendientes) y `prisma db seed` (datos de demostración, `api/prisma/seed.ts`). Para recrear la base desde cero: `docker compose down -v` y volver a levantar.

Para cambiar el esquema: editar `api/prisma/schema.prisma` y ejecutar `pnpm db:migrate` en `api/`. Prisma genera una migración nueva con el SQL del cambio. Los CHECK, exclusiones, índices parciales o triggers nuevos se agregan a mano en el `migration.sql` generado (usar `pnpm prisma migrate dev --create-only` para revisarlo antes de aplicarlo). Ver `api/README.md`.

La migración inicial instala `btree_gist` para impedir solapamientos temporales; la cuenta que migra necesita permiso para instalar esa extensión. UUID usa `gen_random_uuid()`, incluido en PostgreSQL.

## Qué garantiza el SQL

- Relaciones entre registros de la misma organización mediante FK compuestas.
- Referencias dentro del mismo escenario y consistencia entre evidencia, extracción y versión documental.
- Unicidad de códigos, asociaciones, versiones y claves de idempotencia.
- Rangos de niveles, porcentajes y horas; consistencia básica de fechas y estados.
- Intervalos `[inicio, fin)` sin solapamiento para una misma pareja empleado–puesto o empleado–función. Se permiten intervalos adyacentes.
- Restricciones condicionales de tipos documentales y fuentes de evidencia.
- Campos requeridos para habilidades verificadas, revisión humana y aprobaciones.
- Actualización automática de `updated_at` y protección de `id`, `organization_id` y `created_at` ante UPDATE.
- Prohibición de UPDATE/DELETE en Evidence, OperationalObservation, FindingEvidence y AuditEvent mediante triggers. Un propietario de la base puede administrar esos triggers; no es una garantía de inviolabilidad frente al administrador.

El usuario de ejecución de la aplicación debe ser distinto del propietario de los objetos, con permisos mínimos y sin TRUNCATE, DDL o desactivación de triggers. Este archivo no crea roles, credenciales ni políticas RLS. Las FK no impiden por sí mismas que una consulta lea datos de otra empresa.

## Reglas que requieren el backend

El esquema define la estructura completa, pero no implementa todos los servicios de dominio. NestJS deberá implementar y probar:

- Autenticación, autorización y filtros de organización en cada consulta y descarga.
- Prevención de ciclos jerárquicos y conservación de un OWNER activo mediante transacciones y bloqueos.
- Validación de zona IANA, catálogo de métricas, significado de JSON, archivos y hash real.
- Validación de las correcciones de observaciones: misma métrica, alcance, unidad y período; no sumar versiones de una misma observación.
- Transiciones de estados, publicación atómica de diagnósticos y congelación de sus entradas y resultados.
- Inmutabilidad del contenido de archivos confirmados y creación de una nueva versión para cada cambio.
- Coherencia de evidencia, fuentes del snapshot y hallazgos; el SQL comprueba relaciones, no la veracidad del diagnóstico.
- Aprobación de escenarios con control de revisión/concurrencia, jerarquía válida y sin modificaciones posteriores. No aprobar nodos retirados con asignaciones efectivas.
- Prohibir marcadores de funciones sin asignar que coexistan con su asignación efectiva dentro de un escenario.
- Reconciliación entre almacenamiento, PostgreSQL y BullMQ, así como publicación idempotente en reintentos.
- Auditoría de cambios en la misma transacción y procedimiento de retención/purga.

No se debe exponer el esquema directamente al navegador sin esa capa de autorización.

## Comprobar

`002_verificar_integridad.sql` prueba las restricciones en una base que ya tenga el esquema (por ejemplo, la de Docker). Inserta datos temporales dentro de una transacción y termina con ROLLBACK; no conserva sus datos.

```powershell
# Desde la carpeta Proyecto, con Docker levantado:
Get-Content DB\002_verificar_integridad.sql | docker compose exec -T db psql -X -v ON_ERROR_STOP=1 -U diagnostico -d diagnostico
```

Debe terminar con `NOTICE:  OK: 28 tablas; ...`.

Las pruebas comprueban invariantes de integridad del SQL; no sustituyen las pruebas de concurrencia y servicios de dominio mencionadas arriba.
