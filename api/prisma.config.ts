// Configuración de la CLI de Prisma (migraciones y datos de demostración).
// Con este archivo Prisma no lee .env por su cuenta: dotenv lo carga para usar la CLI fuera de Docker.
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
});
