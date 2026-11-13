// Forma de cada persona que devuelve GET /api/talent (pantalla Directorio de Talento).
// Escala de niveles: 1 a 5 (la misma de employee_skills y position_skills). null = sin nivel indicado.

export type FitStatus = 'optimo' | 'critico' | 'desaprovechado' | 'sin-requisitos';

export interface TalentSkill {
  skillId: string;
  name: string;
  category: 'TECHNICAL' | 'BEHAVIORAL';
  level: number | null;
  verificationStatus: 'DECLARED' | 'VERIFIED' | 'REJECTED';
  // Fragmento del CV (u otra fuente) que respalda la competencia.
  evidenceExcerpt: string | null;
}

// Un requisito del cargo y cómo lo cumple la persona.
export interface TalentRequirement {
  skillId: string;
  name: string;
  requiredLevel: number | null;
  isMandatory: boolean;
  weight: number;
  // Nivel de la persona en esa competencia (null si no la tiene o no tiene nivel).
  currentLevel: number | null;
  hasSkill: boolean;
  // 0 a 1: qué tanto cumple este requisito (ver fit-rules.ts).
  coverage: number;
}

export interface TalentItem {
  id: string;
  fullName: string;
  area: string | null;
  position: { id: string; title: string } | null;
  // Competencias confirmadas (employee_skills), sin las rechazadas.
  skills: TalentSkill[];
  requirements: TalentRequirement[];
  // null si el cargo no tiene requisitos definidos (o la persona no tiene cargo).
  fitPercent: number | null;
  status: FitStatus;
  // Explicación en español del estado (qué falta o qué sobra).
  reasons: string[];
}
