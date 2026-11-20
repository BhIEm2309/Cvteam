// Reglas del diagnóstico organizacional (versión 1). Funciones puras, sin base de datos ni IA: reciben una foto de
// la organización (cargos, requisitos, personas y competencias confirmadas) y devuelven hallazgos con su evidencia y
// recomendaciones. Se prueban en test/diagnostic-rules.test.ts.
//
// - El ajuste persona-cargo es el mismo de la pantalla Directorio (talent/fit-rules.ts): un solo cálculo.
// - Todo resultado es una PROPUESTA: nada cambia el organigrama ni los datos confirmados. Una persona decide.
// - Solo usa competencias confirmadas por una persona (employee_skills), nunca las propuestas pendientes de la IA.
import { evaluateFit, FIT_RULES, FitResult, RequirementInput } from '../talent/fit-rules';
import { FitStatus } from '../talent/talent-item';

export const RULESET_VERSION = 'diagnostico-reglas-v1';
export const INPUT_SCHEMA_VERSION = 'diagnostico-entrada-v1';

export const DIAGNOSTIC_RULES = {
  // Máximo de candidatos que se proponen por cargo con vacantes.
  maxCandidatesPerVacancy: 3,
  // Máximo de cargos que se sugieren a una persona sin cargo.
  maxSuggestionsPerPerson: 3,
} as const;

// ---------- Entrada ----------

export interface DiagnosticPosition {
  id: string;
  title: string;
  departmentId: string;
  departmentName: string;
  parentPositionId: string | null;
  targetHeadcount: number;
  requirements: RequirementInput[];
}

export interface DiagnosticPersonSkill {
  skillId: string;
  name: string;
  level: number | null;
  // Evidencia (fragmento del CV) que respalda la competencia; null si se registró sin evidencia.
  evidenceId: string | null;
}

export interface DiagnosticEmployee {
  id: string;
  fullName: string;
  // Cargos con asignación vigente, el principal primero (mayor dedicación). Vacío = sin cargo.
  positionIds: string[];
  skills: DiagnosticPersonSkill[];
}

export interface DiagnosticInput {
  positions: DiagnosticPosition[];
  employees: DiagnosticEmployee[];
}

// ---------- Salida ----------

export type FindingType = 'UNFILLED_POSITION' | 'SKILL_GAP' | 'UNDERUSED_TALENT' | 'INSUFFICIENT_DATA';
export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface RecommendationDraft {
  title: string;
  description: string;
  priority: Severity;
  // Datos para la pantalla (por ejemplo, a quién y a qué cargo se refiere una reasignación).
  metadata: Record<string, unknown>;
}

export interface FindingDraft {
  ruleCode: string;
  // Identifica el hallazgo dentro de un diagnóstico (único por ejecución).
  fingerprint: string;
  type: FindingType;
  severity: Severity;
  title: string;
  description: string;
  departmentId: string | null;
  positionId: string | null;
  employeeId: string | null;
  metrics: Record<string, unknown>;
  // Evidencias (fragmentos del CV) que respaldan el hallazgo.
  evidenceIds: string[];
  recommendations: RecommendationDraft[];
}

export interface DiagnosticSummary {
  positions: number;
  people: number;
  vacancies: number;
  positionsWithoutPeople: number;
  byStatus: Record<FitStatus, number>;
  // Personas sin competencias confirmadas o sin cargo: no se pueden evaluar.
  peopleWithoutData: number;
  peopleWithoutPosition: number;
  positionsWithoutProfile: number;
  reassignmentProposals: number;
}

export interface DiagnosticResult {
  findings: FindingDraft[];
  summary: DiagnosticSummary;
}

// Un posible movimiento: una persona que calza en un cargo con vacantes.
interface Candidate {
  employee: DiagnosticEmployee;
  fit: FitResult;
  currentPosition: DiagnosticPosition | null;
  currentFit: FitResult | null;
}

// ---------- Reglas ----------

export function runDiagnostic(input: DiagnosticInput): DiagnosticResult {
  const positionsById = new Map(input.positions.map((position) => [position.id, position]));
  const headcount = new Map<string, number>();
  for (const employee of input.employees) {
    for (const positionId of new Set(employee.positionIds)) {
      headcount.set(positionId, (headcount.get(positionId) ?? 0) + 1);
    }
  }
  const vacanciesOf = (position: DiagnosticPosition) => Math.max(position.targetHeadcount - (headcount.get(position.id) ?? 0), 0);

  // Ajuste de cada persona en su cargo principal (solo si tiene cargo, requisitos y competencias confirmadas).
  const currentFit = new Map<string, FitResult>();
  for (const employee of input.employees) {
    const position = primaryPosition(employee, positionsById);
    if (position && position.requirements.length > 0 && employee.skills.length > 0) {
      currentFit.set(employee.id, evaluateFit(position.requirements, employee.skills));
    }
  }

  // Candidatos para cada cargo con vacantes y requisitos definidos.
  const candidatesByPosition = new Map<string, Candidate[]>();
  for (const position of input.positions) {
    if (vacanciesOf(position) === 0 || position.requirements.length === 0) continue;
    const candidates = input.employees
      .filter((employee) => employee.skills.length > 0 && !employee.positionIds.includes(position.id))
      .map((employee): Candidate => {
        const current = primaryPosition(employee, positionsById);
        return {
          employee,
          fit: evaluateFit(position.requirements, employee.skills),
          currentPosition: current,
          currentFit: currentFit.get(employee.id) ?? null,
        };
      })
      .filter(isGoodMove)
      .sort((a, b) => (b.fit.fitPercent ?? 0) - (a.fit.fitPercent ?? 0) || a.employee.fullName.localeCompare(b.employee.fullName, 'es'))
      .slice(0, DIAGNOSTIC_RULES.maxCandidatesPerVacancy);
    candidatesByPosition.set(position.id, candidates);
  }

  const findings: FindingDraft[] = [];

  // 1. Cargos con vacantes.
  for (const position of input.positions) {
    const vacancies = vacanciesOf(position);
    if (vacancies === 0) continue;
    const current = headcount.get(position.id) ?? 0;
    const candidates = candidatesByPosition.get(position.id) ?? [];
    const recommendations: RecommendationDraft[] = candidates.map((candidate) => moveRecommendation(candidate, position));
    if (recommendations.length === 0) {
      recommendations.push(
        position.requirements.length === 0
          ? {
              title: `Definir el perfil del cargo ${position.title}`,
              description: 'Sin competencias requeridas no se pueden buscar candidatos dentro de la empresa.',
              priority: 'MEDIUM',
              metadata: { kind: 'definir-perfil', positionId: position.id },
            }
          : {
              title: `Buscar candidatos para ${position.title}`,
              description: `Nadie de la empresa cumple hoy el perfil (ajuste de ${FIT_RULES.optimalFromPercent} % o más, con todas las obligatorias). Obligatorias: ${listNames(position.requirements.filter((r) => r.isMandatory))}.`,
              priority: current === 0 ? 'HIGH' : 'MEDIUM',
              metadata: { kind: 'buscar-candidatos', positionId: position.id },
            },
      );
    }
    findings.push({
      ruleCode: current === 0 ? 'ROL_SIN_PERSONAS' : 'VACANTE',
      fingerprint: `vacante:${position.id}`,
      type: 'UNFILLED_POSITION',
      severity: current === 0 ? 'HIGH' : 'MEDIUM',
      title: current === 0 ? `Rol sin personas: ${position.title}` : `${plural(vacancies, 'vacante', 'vacantes')} en ${position.title}`,
      description: `Dotación objetivo ${position.targetHeadcount}; hoy ${plural(current, 'persona', 'personas')}.`,
      departmentId: position.departmentId,
      positionId: position.id,
      employeeId: null,
      metrics: { targetHeadcount: position.targetHeadcount, currentHeadcount: current, vacancies, hasProfile: position.requirements.length > 0 },
      evidenceIds: [],
      recommendations,
    });
  }

  // 2. Ajuste de cada persona en su cargo.
  const byStatus: Record<FitStatus, number> = { optimo: 0, parcial: 0, critico: 0, desaprovechado: 0, 'sin-requisitos': 0 };
  let peopleWithoutData = 0;
  let peopleWithoutPosition = 0;

  for (const employee of input.employees) {
    const position = primaryPosition(employee, positionsById);
    if (position === null) {
      peopleWithoutPosition++;
      findings.push(withoutPositionFinding(employee, input.positions, candidatesByPosition));
      continue;
    }
    if (employee.skills.length === 0) {
      // Sin competencias confirmadas no hay cómo saber si calza: falta información, no es un desajuste.
      peopleWithoutData++;
      findings.push({
        ruleCode: 'PERSONA_SIN_COMPETENCIAS',
        fingerprint: `sin-competencias:${employee.id}`,
        type: 'INSUFFICIENT_DATA',
        severity: 'LOW',
        title: `Sin competencias confirmadas: ${employee.fullName}`,
        description: `No se puede evaluar su ajuste a ${position.title}. Sube y revisa su CV.`,
        departmentId: position.departmentId,
        positionId: position.id,
        employeeId: employee.id,
        metrics: {},
        evidenceIds: [],
        recommendations: [],
      });
      continue;
    }
    const fit = currentFit.get(employee.id);
    if (!fit) {
      byStatus['sin-requisitos']++;
      continue;
    }
    byStatus[fit.status]++;
    const finding = fitFinding(employee, position, fit, input.positions, candidatesByPosition);
    if (finding) findings.push(finding);
  }

  // 3. Cargos sin perfil (sin competencias requeridas): no se puede evaluar a nadie en ellos.
  let positionsWithoutProfile = 0;
  for (const position of input.positions) {
    if (position.requirements.length > 0) continue;
    positionsWithoutProfile++;
    findings.push({
      ruleCode: 'CARGO_SIN_PERFIL',
      fingerprint: `sin-perfil:${position.id}`,
      type: 'INSUFFICIENT_DATA',
      severity: 'LOW',
      title: `Cargo sin perfil: ${position.title}`,
      description: 'No tiene competencias requeridas: no se calcula el ajuste de sus personas ni se buscan candidatos.',
      departmentId: position.departmentId,
      positionId: position.id,
      employeeId: null,
      metrics: { currentHeadcount: headcount.get(position.id) ?? 0 },
      evidenceIds: [],
      recommendations: [],
    });
  }

  const reassignmentProposals = findings
    .flatMap((finding) => finding.recommendations)
    .filter((recommendation) => recommendation.metadata.kind === 'reasignar').length;

  return {
    findings,
    summary: {
      positions: input.positions.length,
      people: input.employees.length,
      vacancies: input.positions.reduce((sum, position) => sum + vacanciesOf(position), 0),
      positionsWithoutPeople: input.positions.filter((position) => (headcount.get(position.id) ?? 0) === 0).length,
      byStatus,
      peopleWithoutData,
      peopleWithoutPosition,
      positionsWithoutProfile,
      reassignmentProposals,
    },
  };
}

// Una persona es buena candidata para un cargo con vacantes si cumple su perfil (Óptimo o mejor, sin obligatorias
// faltantes) y moverla tiene sentido: no tiene cargo, o en el suyo está en desajuste crítico, ajuste parcial o
// desaprovechada (en ese caso, solo hacia un cargo donde ya no quedaría desaprovechada). A quien ya está bien en su
// cargo no se le propone moverse: abriría otra vacante.
function isGoodMove(candidate: Candidate): boolean {
  if (candidate.fit.status !== 'optimo' && candidate.fit.status !== 'desaprovechado') return false;
  if (candidate.currentPosition === null) return true;
  const currentStatus = candidate.currentFit?.status;
  if (currentStatus === 'critico' || currentStatus === 'parcial') return true;
  if (currentStatus === 'desaprovechado') return candidate.fit.status === 'optimo';
  return false;
}

function moveRecommendation(candidate: Candidate, position: DiagnosticPosition): RecommendationDraft {
  const { employee, fit, currentPosition, currentFit } = candidate;
  const from = currentPosition
    ? `Hoy es ${currentPosition.title}${currentFit ? ` (${currentFit.fitPercent} %, ${STATUS_LABELS[currentFit.status]})` : ''}.`
    : 'Hoy no tiene cargo asignado.';
  return {
    title: `Evaluar a ${employee.fullName} para ${position.title}`,
    description: `Ajuste de ${fit.fitPercent} % con el perfil de ${position.title} (${STATUS_LABELS[fit.status]}). ${from} ${fit.reasons.join(' ')}`.trim(),
    priority: currentPosition === null ? 'HIGH' : 'MEDIUM',
    metadata: {
      kind: 'reasignar',
      employeeId: employee.id,
      employeeName: employee.fullName,
      toPositionId: position.id,
      toPositionTitle: position.title,
      fitPercent: fit.fitPercent,
      status: fit.status,
      fromPositionId: currentPosition?.id ?? null,
      fromPositionTitle: currentPosition?.title ?? null,
      currentFitPercent: currentFit?.fitPercent ?? null,
    },
  };
}

function fitFinding(
  employee: DiagnosticEmployee,
  position: DiagnosticPosition,
  fit: FitResult,
  positions: DiagnosticPosition[],
  candidatesByPosition: Map<string, Candidate[]>,
): FindingDraft | null {
  if (fit.status === 'optimo' || fit.status === 'sin-requisitos') return null;

  const evidenceOf = new Map(employee.skills.map((skill) => [skill.skillId, skill.evidenceId]));
  const required = new Set(position.requirements.map((requirement) => requirement.skillId));
  const missing = fit.requirements.filter((r) => !r.hasSkill).map((r) => ({ name: r.name, isMandatory: r.isMandatory, requiredLevel: r.requiredLevel }));
  const belowLevel = fit.requirements
    .filter((r) => r.hasSkill && r.requiredLevel !== null && (r.currentLevel === null || r.currentLevel < r.requiredLevel))
    .map((r) => ({ skillId: r.skillId, name: r.name, currentLevel: r.currentLevel, requiredLevel: r.requiredLevel }));
  const aboveLevel = fit.requirements
    .filter((r) => r.hasSkill && r.requiredLevel !== null && r.currentLevel !== null && r.currentLevel > r.requiredLevel)
    .map((r) => ({ skillId: r.skillId, name: r.name, currentLevel: r.currentLevel, requiredLevel: r.requiredLevel }));
  const notRequired = employee.skills.filter((skill) => !required.has(skill.skillId));
  const metrics = {
    fitPercent: fit.fitPercent,
    status: fit.status,
    reasons: fit.reasons,
    missing,
    belowLevel: belowLevel.map(({ skillId: _skillId, ...rest }) => rest),
    aboveLevel: aboveLevel.map(({ skillId: _skillId, ...rest }) => rest),
    notRequired: notRequired.map((skill) => ({ name: skill.name, level: skill.level })),
  };

  // Movimientos propuestos: cargos con vacantes donde esta persona quedó entre los candidatos.
  const moves = positions
    .filter((other) => (candidatesByPosition.get(other.id) ?? []).some((candidate) => candidate.employee.id === employee.id))
    .map((other) => moveRecommendation(candidatesByPosition.get(other.id)!.find((c) => c.employee.id === employee.id)!, other));

  const base = {
    fingerprint: `ajuste:${employee.id}`,
    departmentId: position.departmentId,
    positionId: position.id,
    employeeId: employee.id,
    metrics,
  };

  if (fit.status === 'desaprovechado') {
    const evidenceIds = unique([...aboveLevel.map((r) => evidenceOf.get(r.skillId)), ...notRequired.map((s) => s.evidenceId)]);
    return {
      ...base,
      ruleCode: 'TALENTO_DESAPROVECHADO',
      type: 'UNDERUSED_TALENT',
      severity: 'MEDIUM',
      title: `Talento desaprovechado: ${employee.fullName} (${position.title})`,
      description: `Cumple el 100 % del perfil y lo supera. ${fit.reasons.join(' ')}${aboveLevel.length > 0 ? ` Sobre el nivel pedido: ${listNames(aboveLevel)}.` : ''}`,
      evidenceIds,
      recommendations:
        moves.length > 0
          ? moves
          : [
              {
                title: `Evaluar más responsabilidades para ${employee.fullName}`,
                description: 'No hay hoy un cargo con vacantes donde calce mejor. Considerar tareas de mayor exigencia o un cargo nuevo.',
                priority: 'LOW',
                metadata: { kind: 'mas-responsabilidades', employeeId: employee.id },
              },
            ],
    };
  }

  const evidenceIds = unique(belowLevel.map((r) => evidenceOf.get(r.skillId)));
  const gaps = [...missing.map((r) => r.name), ...belowLevel.map((r) => r.name)];
  const development: RecommendationDraft = {
    title: `Plan de desarrollo para ${employee.fullName}`,
    description: `Reforzar: ${gaps.join(', ')}.`,
    priority: fit.status === 'critico' ? 'MEDIUM' : 'LOW',
    metadata: { kind: 'desarrollo', employeeId: employee.id, skills: gaps },
  };
  const missingMandatory = missing.some((r) => r.isMandatory);
  return {
    ...base,
    ruleCode: fit.status === 'critico' ? 'DESAJUSTE_CRITICO' : 'AJUSTE_PARCIAL',
    type: 'SKILL_GAP',
    severity: fit.status === 'critico' ? (missingMandatory ? 'HIGH' : 'MEDIUM') : 'LOW',
    title: `${fit.status === 'critico' ? 'Desajuste crítico' : 'Ajuste parcial'}: ${employee.fullName} (${position.title})`,
    description: `Ajuste de ${fit.fitPercent} %. ${fit.reasons.join(' ')}`,
    evidenceIds,
    recommendations: gaps.length > 0 ? [...moves, development] : moves,
  };
}

function withoutPositionFinding(
  employee: DiagnosticEmployee,
  positions: DiagnosticPosition[],
  candidatesByPosition: Map<string, Candidate[]>,
): FindingDraft {
  const moves = positions
    .filter((position) => (candidatesByPosition.get(position.id) ?? []).some((c) => c.employee.id === employee.id))
    .map((position) => moveRecommendation(candidatesByPosition.get(position.id)!.find((c) => c.employee.id === employee.id)!, position));

  // Si no calza en ninguna vacante, se muestran igual los cargos con perfil donde tendría mejor ajuste.
  const bestFits = positions
    .filter((position) => position.requirements.length > 0 && employee.skills.length > 0)
    .map((position) => ({ position, fit: evaluateFit(position.requirements, employee.skills) }))
    .sort((a, b) => (b.fit.fitPercent ?? 0) - (a.fit.fitPercent ?? 0))
    .slice(0, DIAGNOSTIC_RULES.maxSuggestionsPerPerson);

  return {
    ruleCode: 'PERSONA_SIN_CARGO',
    fingerprint: `sin-cargo:${employee.id}`,
    type: 'INSUFFICIENT_DATA',
    severity: moves.length > 0 ? 'MEDIUM' : 'LOW',
    title: `Sin cargo asignado: ${employee.fullName}`,
    description:
      employee.skills.length === 0
        ? 'No tiene cargo ni competencias confirmadas.'
        : bestFits.length === 0
          ? 'No tiene cargo y no hay cargos con perfil para compararla.'
          : `Mejor ajuste: ${bestFits.map((item) => `${item.position.title} ${item.fit.fitPercent} %`).join(', ')}.`,
    departmentId: null,
    positionId: null,
    employeeId: employee.id,
    metrics: { bestFits: bestFits.map((item) => ({ positionId: item.position.id, title: item.position.title, fitPercent: item.fit.fitPercent, status: item.fit.status })) },
    evidenceIds: unique(employee.skills.map((skill) => skill.evidenceId)),
    recommendations: moves,
  };
}

// ---------- Utilidades ----------

const STATUS_LABELS: Record<FitStatus, string> = {
  optimo: 'óptimo',
  parcial: 'ajuste parcial',
  critico: 'desajuste crítico',
  desaprovechado: 'talento desaprovechado',
  'sin-requisitos': 'sin requisitos',
};

function primaryPosition(employee: DiagnosticEmployee, positionsById: Map<string, DiagnosticPosition>): DiagnosticPosition | null {
  for (const positionId of employee.positionIds) {
    const position = positionsById.get(positionId);
    if (position) return position;
  }
  return null;
}

function unique(ids: (string | null | undefined)[]): string[] {
  return [...new Set(ids.filter((id): id is string => typeof id === 'string'))];
}

function listNames(items: { name: string }[]): string {
  return items.length === 0 ? 'ninguna' : items.map((item) => item.name).join(', ');
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}
