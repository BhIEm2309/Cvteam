# Imagen de DESARROLLO: servidor de Vite con recarga en caliente.
# El código se monta desde el equipo (ver docker-compose.yml); node_modules vive dentro del contenedor.
FROM node:22-alpine

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

EXPOSE 5173
CMD ["pnpm", "dev", "--host", "0.0.0.0", "--port", "5173", "--strictPort"]
