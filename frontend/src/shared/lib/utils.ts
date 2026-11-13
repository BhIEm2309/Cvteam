// Reexporta cn() del paquete oficial "cn" de shadcn (github.com/shadcn-ui/cn): une clases y resuelve
// conflictos de Tailwind, igual que clsx + tailwind-merge. Los componentes de shared/ui lo importan directo
// desde "cn"; este archivo existe porque components.json lo declara como alias "utils" para el CLI de shadcn.
export { cn } from "cn"
