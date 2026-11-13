import { EmployeeStatus } from '@prisma/client';

// Cargo vigente de una persona.
export interface EmployeeCurrentPosition {
  positionId: string;
  positionTitle: string;
  departmentId: string;
  departmentName: string;
  allocationPercent: number;
  // Fecha de inicio (AAAA-MM-DD).
  startDate: string;
}

// Forma de cada persona que devuelve la API al frontend (GET /api/employees).
// No incluye el ajuste al cargo ni competencias: eso será /api/talent (pasos 5 y 6).
export interface EmployeeItem {
  id: string;
  employeeCode: string | null;
  fullName: string;
  email: string | null;
  weeklyCapacityHours: number | null;
  status: EmployeeStatus;
  // Normalmente uno; puede haber más si la persona reparte su tiempo entre cargos.
  currentPositions: EmployeeCurrentPosition[];
  createdAt: Date;
  updatedAt: Date;
}
