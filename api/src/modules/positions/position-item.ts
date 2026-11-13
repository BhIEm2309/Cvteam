import { Severity } from '@prisma/client';

// Forma de cada cargo (puesto) que devuelve la API al frontend.
export interface PositionItem {
  id: string;
  code: string;
  title: string;
  description: string | null;
  departmentId: string;
  departmentName: string;
  // Cargo superior (jefatura directa). null si es el cargo más alto.
  parentPositionId: string | null;
  parentPositionTitle: string | null;
  // Cuántas personas debería tener el cargo.
  targetHeadcount: number;
  // Cuántas personas tienen hoy una asignación vigente en el cargo.
  currentHeadcount: number;
  criticality: Severity;
  createdAt: Date;
  updatedAt: Date;
}
