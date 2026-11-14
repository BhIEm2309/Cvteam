import { OrgChartError } from './org-chart-csv';

// Respuesta de POST /api/org-chart/import (tanto en "preview" como en "apply").
export interface OrgChartImportResult {
  mode: 'preview' | 'apply';
  // false: el archivo tiene errores y no se guardó nada.
  ok: boolean;
  // true solo en "apply" cuando los cambios quedaron guardados.
  saved: boolean;
  rowCount: number;
  errors: OrgChartError[];
  // Avisos que no impiden importar (por ejemplo, dotación objetivo menor que las personas asignadas).
  warnings: OrgChartError[];
  summary: OrgChartImportSummary | null;
}

export interface OrgChartImportSummary {
  departments: { created: string[]; existing: number };
  positions: {
    created: { title: string; department: string; targetHeadcount: number }[];
    // Cargos que ya existían y cambian de cargo superior.
    parentChanged: { title: string; department: string; from: string | null; to: string | null }[];
    // Cargos que ya existían y cambian de dotación objetivo.
    headcountChanged: { title: string; department: string; from: number; to: number }[];
    // Cargos existentes sin cambios de jefatura ni de dotación.
    unchanged: number;
  };
  employees: {
    created: { fullName: string; position: string }[];
    positionChanged: { fullName: string; from: string | null; to: string }[];
    unchanged: number;
  };
  // Personas activas que no vienen en el archivo. NO se archivan: se informan para que una persona decida.
  notInFile: { fullName: string; position: string | null }[];
}
