import { FlaskConical, LayoutGrid, Upload, Users, type LucideIcon } from 'lucide-react'

// Páginas que aparecen en el menú. Se usa en la barra lateral y en la barra superior.
export interface NavigationItem {
  path: string
  label: string
  icon: LucideIcon
}

export const NAVIGATION_ITEMS: NavigationItem[] = [
  { path: '/hub', label: 'Hub', icon: LayoutGrid },
  { path: '/ingesta', label: 'Ingesta de CVs', icon: Upload },
  { path: '/directorio', label: 'Directorio de Talento', icon: Users },
  { path: '/laboratorio', label: 'Laboratorio', icon: FlaskConical },
]
