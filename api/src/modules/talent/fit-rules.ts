// Regla explicable de ajuste al cargo (Directorio de Talento). Funciones puras: se prueban en test/talent.test.ts.
//
// Esta regla es una vista rápida que se calcula al consultar; no reemplaza al diagnóstico (módulo diagnostics),
// que guardará hallazgos con su evidencia. Los umbrales son decisiones de negocio (confirmados el 13-11-2026;
// "Ajuste parcial" agregado el 19-11-2026): cambiarlos solo aquí y anotarlo en CLAUDE.md.
import { FitStatus, TalentRequirement } from './talent-item';

export const FIT_RULES = {
  // Bajo este % de ajuste la persona queda en "Desajuste crítico".
  criticalBelowPercent: 60,
  // Desde este % (y sin faltar obligatorias) el ajuste es "Óptimo"; entre criticalBelowPercent y esto, "Ajuste parcial".
  optimalFromPercent: 85,
  // Cobertura de un requisito cuando la persona tiene la competencia pero sin nivel indicado.
  unknownLevelCoverage: 0.5,
  // "Talento desaprovechado": ajuste 100 % y, en promedio, supera el nivel requerido en al menos esto.
  underusedMinExcessLevels: 1,
} as const;

export interface RequirementInput {
  skillId: string;
  name: string;
  requiredLevel: number | null;
  isMandatory: boolean;
  weight: number;
}

export interface PersonSkillInput {
  skillId: string;
  level: number | null;
}

export interface FitResult {
  requirements: TalentRequirement[];
  fitPercent: number | null;
  status: FitStatus;
  reasons: string[];
}

// Qué tanto cumple la persona un requisito (0 a 1).
export function requirementCoverage(requiredLevel: number | null, hasSkill: boolean, currentLevel: number | null): number {
  if (!hasSkill) return 0;
  if (requiredLevel === null) return 1;
  if (currentLevel === null) return FIT_RULES.unknownLevelCoverage;
  return Math.min(currentLevel / requiredLevel, 1);
}

/**
 * Ajuste = promedio de las coberturas ponderado por el peso de cada requisito, en %.
 * Estado:
 *   sin-requisitos  el cargo no tiene requisitos definidos;
 *   critico         falta una competencia obligatoria o el ajuste es menor que criticalBelowPercent;
 *   desaprovechado  ajuste 100 % y supera en promedio el nivel requerido en underusedMinExcessLevels o más;
 *   parcial         cumple lo obligatorio, pero el ajuste es menor que optimalFromPercent;
 *   optimo          los demás casos (ajuste desde optimalFromPercent).
 */
export function evaluateFit(requirementsInput: RequirementInput[], personSkills: PersonSkillInput[]): FitResult {
  if (requirementsInput.length === 0) {
    return { requirements: [], fitPercent: null, status: 'sin-requisitos', reasons: ['El cargo no tiene requisitos definidos.'] };
  }

  const levels = new Map(personSkills.map((skill) => [skill.skillId, skill.level]));
  const requirements: TalentRequirement[] = requirementsInput.map((requirement) => {
    const hasSkill = levels.has(requirement.skillId);
    const currentLevel = hasSkill ? (levels.get(requirement.skillId) ?? null) : null;
    return {
      ...requirement,
      currentLevel,
      hasSkill,
      coverage: requirementCoverage(requirement.requiredLevel, hasSkill, currentLevel),
    };
  });

  const totalWeight = requirements.reduce((sum, requirement) => sum + requirement.weight, 0);
  const covered = requirements.reduce((sum, requirement) => sum + requirement.weight * requirement.coverage, 0);
  const fitPercent = totalWeight > 0 ? Math.round((covered / totalWeight) * 100) : 0;

  // Explicación: primero lo obligatorio que falta, después lo que está bajo el nivel o sin nivel.
  const reasons: string[] = [];
  const missingMandatory = requirements.filter((requirement) => requirement.isMandatory && !requirement.hasSkill);
  for (const requirement of missingMandatory) {
    reasons.push(`Falta la competencia obligatoria "${requirement.name}".`);
  }
  for (const requirement of requirements) {
    if (!requirement.hasSkill && !requirement.isMandatory) {
      reasons.push(`No registra "${requirement.name}" (deseable).`);
    } else if (requirement.hasSkill && requirement.requiredLevel !== null && requirement.currentLevel === null) {
      reasons.push(`"${requirement.name}": la tiene, nivel por confirmar (requerido ${requirement.requiredLevel}).`);
    } else if (requirement.hasSkill && requirement.requiredLevel !== null && requirement.currentLevel! < requirement.requiredLevel) {
      reasons.push(`"${requirement.name}": nivel ${requirement.currentLevel} de ${requirement.requiredLevel} requerido.`);
    }
  }

  if (missingMandatory.length > 0 || fitPercent < FIT_RULES.criticalBelowPercent) {
    if (missingMandatory.length === 0) {
      reasons.unshift(`Ajuste de ${fitPercent} %, bajo el mínimo de ${FIT_RULES.criticalBelowPercent} %.`);
    }
    return { requirements, fitPercent, status: 'critico', reasons };
  }

  // Exceso promedio sobre el nivel requerido, solo en requisitos con nivel requerido y nivel conocido.
  const comparable = requirements.filter((requirement) => requirement.requiredLevel !== null && requirement.currentLevel !== null);
  const averageExcess =
    comparable.length === 0
      ? 0
      : comparable.reduce((sum, requirement) => sum + (requirement.currentLevel! - requirement.requiredLevel!), 0) / comparable.length;

  if (fitPercent === 100 && comparable.length > 0 && averageExcess >= FIT_RULES.underusedMinExcessLevels) {
    reasons.push(`Supera en promedio ${formatLevels(averageExcess)} lo que exige su cargo.`);
    return { requirements, fitPercent, status: 'desaprovechado', reasons };
  }

  if (fitPercent < FIT_RULES.optimalFromPercent) {
    reasons.unshift(`Ajuste de ${fitPercent} %: cumple lo obligatorio, pero está bajo el ${FIT_RULES.optimalFromPercent} % de un ajuste óptimo.`);
    return { requirements, fitPercent, status: 'parcial', reasons };
  }

  if (reasons.length === 0) {
    reasons.push('Cumple todos los requisitos del cargo.');
  }
  return { requirements, fitPercent, status: 'optimo', reasons };
}

function formatLevels(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace('.', ',');
  return rounded === 1 ? '1 nivel' : `${text} niveles`;
}
