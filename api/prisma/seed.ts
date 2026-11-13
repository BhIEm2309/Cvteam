/**
 * Datos de demostración para desarrollo local. NO usar en producción.
 *
 * Se ejecuta con `pnpm db:seed` (Docker lo hace al iniciar la API). Es idempotente: usa IDs fijos y upsert,
 * así que ejecutarlo varias veces no duplica registros.
 *
 * Mientras no exista autenticación real, la API trabajará como el OWNER de la organización "demo".
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO = {
  organizationId: '00000000-0000-4000-8000-000000000001',
  userId: '00000000-0000-4000-8000-000000000101',
  authSubject: '00000000-0000-4000-8000-000000000201',
  memberId: '00000000-0000-4000-8000-000000000301',
};

async function main() {
  const organization = await prisma.organization.upsert({
    where: { id: DEMO.organizationId },
    update: {},
    create: { id: DEMO.organizationId, name: 'Empresa Demo', slug: 'demo', industry: 'Minería' },
  });

  const user = await prisma.user.upsert({
    where: { id: DEMO.userId },
    update: {},
    create: {
      id: DEMO.userId,
      authSubject: DEMO.authSubject,
      email: 'demo@example.com',
      displayName: 'Usuario Demo',
    },
  });

  await prisma.organizationMember.upsert({
    where: { id: DEMO.memberId },
    update: {},
    create: { id: DEMO.memberId, organizationId: organization.id, userId: user.id, role: 'OWNER' },
  });

  console.log(`Datos de demostración listos: ${organization.name} (slug "${organization.slug}"), ${user.displayName} como OWNER.`);
}

main()
  .catch((error) => {
    console.error('Error al cargar los datos de demostración:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
