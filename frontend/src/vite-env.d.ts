/// <reference types="vite/client" />

// Variables de entorno del frontend (ver .env.example y src/shared/lib/data-mode.ts).
interface ImportMetaEnv {
  readonly VITE_DATA_MODE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
