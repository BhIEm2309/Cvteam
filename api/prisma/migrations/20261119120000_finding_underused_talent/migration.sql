-- Paso 4 del diagnóstico (19-11-2026): tipo de hallazgo "Talento desaprovechado" (la persona supera lo que exige
-- su cargo). Generado con prisma migrate diff a partir de schema.prisma. Solo agrega un valor: no cambia datos.
-- AlterEnum
ALTER TYPE "finding_type" ADD VALUE 'UNDERUSED_TALENT';
