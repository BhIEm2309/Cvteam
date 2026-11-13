// Forma de cada área que devuelve la API al frontend.
export interface DepartmentItem {
  id: string;
  code: string;
  name: string;
  description: string | null;
  parentDepartmentId: string | null;
  parentDepartmentName: string | null;
  createdAt: Date;
  updatedAt: Date;
}
