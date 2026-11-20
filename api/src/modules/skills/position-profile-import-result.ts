import { OrgChartError } from '../org-chart-import/org-chart-csv';

// Respuesta de POST /api/position-profiles/import (en "preview" y en "apply"). Misma forma general que el
// importador de organigrama: errores y advertencias con su número de fila, y un resumen de lo que cambia.
export interface PositionProfileImportResult {
  mode: 'preview' | 'apply';
  // false: el archivo tiene errores y no se guardó nada.
  ok: boolean;
  // true solo en "apply" cuando los cambios quedaron guardados.
  saved: boolean;
  rowCount: number;
  errors: OrgChartError[];
  // Avisos que no impiden importar (por ejemplo, una competencia que ya existe con otra categoría).
  warnings: OrgChartError[];
  summary: PositionProfileImportSummary | null;
}

export interface PositionProfileImportSummary {
  // Cada cargo del archivo con los requisitos que tendrá (reemplazan a los que tenía).
  positions: {
    title: string;
    department: string;
    previousCount: number;
    requirements: {
      name: string;
      category: 'TECHNICAL' | 'BEHAVIORAL';
      requiredLevel: number | null;
      isMandatory: boolean;
      weight: number;
      // true = la competencia no estaba en el catálogo y se creará.
      isNewSkill: boolean;
    }[];
    // Requisitos que tenía el cargo y que el archivo no trae: se quitan.
    removed: string[];
  }[];
  createdSkills: string[];
  // Cargos activos que no vienen en el archivo: sus requisitos no cambian.
  positionsNotInFile: number;
}
