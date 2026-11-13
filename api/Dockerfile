# Imagen de DESARROLLO: ejecuta `nest start --watch` y recarga al guardar.
# El código se monta desde el equipo (ver docker-compose.yml); node_modules vive dentro del contenedor.
FROM node:22-alpine

# Prisma necesita OpenSSL en Alpine.
RUN apk add --no-cache openssl
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

COPY . .

EXPOSE 3000
# Al iniciar: regenera el cliente (por si cambió schema.prisma), aplica las migraciones pendientes,
# carga los datos de demostración (idempotente) y arranca la API con recarga automática.
CMD ["sh", "-c", "pnpm prisma generate && pnpm db:deploy && pnpm db:seed && pnpm start:dev"]
