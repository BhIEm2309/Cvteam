import { DiagnosticSummary, FindingType, Severity } from './diagnostic-rules';

// Respuestas de /api/diagnostics (pantalla Laboratorio, estructura propuesta).

export interface RecommendationItem {
  id: string;
  title: string;
  description: string;
  priority: Severity;
  // PROPOSED = pendiente de decisión; ACCEPTED / REJECTED = una persona decidió (no cambia el organigrama).
  status: 'PROPOSED' | 'ACCEPTED' | 'REJECTED' | 'APPLIED';
  // Datos de la regla (por ejemplo, persona y cargo de una reasignación: kind = "reasignar").
  metadata: Record<string, unknown>;
  decidedAt: Date | null;
  decisionNotes: string | null;
}

export interface FindingItem {
  id: string;
  ruleCode: string;
  type: FindingType;
  severity: Severity;
  title: string;
  description: string;
  positionId: string | null;
  employeeId: string | null;
  metrics: Record<string, unknown>;
  // Fragmentos del CV que respaldan el hallazgo.
  evidence: { id: string; excerpt: string }[];
  recommendations: RecommendationItem[];
}

export interface DiagnosticRunItem {
  id: string;
  createdAt: Date;
  // AAAA-MM-DD
  asOfDate: string;
  rulesetVersion: string;
  // true = los datos (cargos, requisitos, personas o competencias) cambiaron después de este diagnóstico.
  isOutdated: boolean;
  summary: DiagnosticSummary;
  findings: FindingItem[];
}

export interface RunDiagnosticResponse {
  // false = los datos no cambiaron desde el último diagnóstico: se devuelve ese mismo (no se duplica).
  created: boolean;
  run: DiagnosticRunItem;
}
