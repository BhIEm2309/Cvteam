// Revisión humana de las competencias propuestas por la IA: validación de la entrada y reglas sin base de datos.
// Se prueban en test/extraction.test.ts. La parte que escribe en la base está en proposal-review.service.ts.
import { BadRequestException } from '@nestjs/common';
import { readOptionalText, readRequiredUuid, toObject } from '../../common/input';
import { generateCode, normalizeKey } from '../org-chart-import/org-chart-csv';
import { SKILL_CATEGORIES } from './cv-extraction-schema';

export type SkillCategory = (typeof SKILL_CATEGORIES)[number];

export const MAX_DECISIONS = 200;
const MAX_SKILL_NAME = 160;
const MAX_EMPLOYEE_NAME = 200;
// skills.code admite 80 caracteres.
const MAX_SKILL_CODE = 80;

export interface ReviewDecision {
  proposalId: string;
  action: 'confirm' | 'dismiss';
  // Correcciones de quien revisa. undefined = se usa lo que propuso la IA.
  name?: string;
  category?: SkillCategory;
  // null = sin nivel.
  level?: number | null;
}

export interface ReviewInput {
  // A quién pertenece el CV. Obligatorio solo si se confirma alguna competencia.
  employeeId: string | null;
  // Alternativa a employeeId: crear la persona con este nombre (sin cargo).
  newEmployeeName: string | null;
  decisions: ReviewDecision[];
}

// Lee y valida el cuerpo de POST /api/documents/:id/extraction/review. Responde 400 con mensajes en español.
export function parseReviewInput(body: unknown): ReviewInput {
  const data = toObject(body);

  const employeeId = data.employeeId === undefined || data.employeeId === null ? null : readRequiredUuid(data.employeeId, 'employeeId');
  const newEmployeeName = readOptionalText(data.newEmployeeName, 'newEmployeeName', MAX_EMPLOYEE_NAME) ?? null;
  if (employeeId !== null && newEmployeeName !== null) {
    throw new BadRequestException('Indica una persona existente (employeeId) o una nueva (newEmployeeName), no ambas.');
  }

  if (!Array.isArray(data.decisions) || data.decisions.length === 0) {
    throw new BadRequestException('El campo "decisions" debe ser una lista con al menos una decisión.');
  }
  if (data.decisions.length > MAX_DECISIONS) {
    throw new BadRequestException(`Se admiten como máximo ${MAX_DECISIONS} decisiones por revisión.`);
  }

  const seen = new Set<string>();
  const decisions = data.decisions.map((raw, index) => {
    const item = toObject(raw);
    const field = (name: string) => `decisions[${index}].${name}`;
    const proposalId = readRequiredUuid(item.proposalId, field('proposalId'));
    if (seen.has(proposalId)) {
      throw new BadRequestException(`La propuesta ${proposalId} aparece más de una vez.`);
    }
    seen.add(proposalId);

    if (item.action !== 'confirm' && item.action !== 'dismiss') {
      throw new BadRequestException(`El campo "${field('action')}" debe ser "confirm" o "dismiss".`);
    }
    const decision: ReviewDecision = { proposalId, action: item.action };

    if (item.name !== undefined) {
      const name = readOptionalText(item.name, field('name'), MAX_SKILL_NAME);
      if (name === null || name === undefined) {
        throw new BadRequestException(`El campo "${field('name')}" no puede quedar vacío.`);
      }
      decision.name = name.replace(/\s+/g, ' ');
    }
    if (item.category !== undefined) {
      if (!SKILL_CATEGORIES.includes(item.category as SkillCategory)) {
        throw new BadRequestException(`El campo "${field('category')}" debe ser ${SKILL_CATEGORIES.join(' o ')}.`);
      }
      decision.category = item.category as SkillCategory;
    }
    if (item.level !== undefined) {
      if (item.level !== null && (typeof item.level !== 'number' || !Number.isInteger(item.level) || item.level < 1 || item.level > 5)) {
        throw new BadRequestException(`El campo "${field('level')}" debe ser un entero de 1 a 5 o null.`);
      }
      decision.level = item.level as number | null;
    }
    return decision;
  });

  const confirms = decisions.some((decision) => decision.action === 'confirm');
  if (confirms && employeeId === null && newEmployeeName === null) {
    throw new BadRequestException('Para confirmar competencias hay que indicar a qué persona pertenece el CV.');
  }

  return { employeeId, newEmployeeName, decisions };
}

// Valores finales de una competencia confirmada: lo que propuso la IA, con las correcciones de quien revisa.
export function finalSkillValues(
  proposal: { name: string; category: SkillCategory; level: number | null },
  decision: ReviewDecision,
): { name: string; category: SkillCategory; level: number | null } {
  return {
    name: decision.name ?? proposal.name,
    category: decision.category ?? proposal.category,
    level: decision.level === undefined ? proposal.level : decision.level,
  };
}

/**
 * Catálogo de competencias de la organización. Busca por nombre sin importar mayúsculas, tildes ni espacios.
 * Si no existe, prepara una nueva con un código único. No une competencias parecidas con otro nombre
 * ("SAP PM" y "SAP Plant Maintenance" quedan separadas): eso lo decide una persona.
 */
export class SkillCatalog {
  private readonly byKey = new Map<string, string>();
  private readonly takenCodes: Set<string>;

  constructor(activeSkills: { id: string; name: string }[], allCodes: string[]) {
    for (const skill of activeSkills) {
      this.byKey.set(normalizeKey(skill.name), skill.id);
    }
    this.takenCodes = new Set(allCodes);
  }

  find(name: string): string | undefined {
    return this.byKey.get(normalizeKey(name));
  }

  // Código para una competencia nueva (no repite ninguno, incluidos los de competencias archivadas).
  newCode(name: string): string {
    return generateCode(name, this.takenCodes, MAX_SKILL_CODE);
  }

  remember(name: string, skillId: string): void {
    this.byKey.set(normalizeKey(name), skillId);
  }
}

// Persona sugerida para el CV: la única persona activa cuyo nombre coincide con el que detectó la IA.
export function suggestEmployee(candidateName: string | null, employees: { id: string; fullName: string }[]): string | null {
  if (candidateName === null || candidateName.trim() === '') {
    return null;
  }
  const key = normalizeKey(candidateName);
  const matches = employees.filter((employee) => normalizeKey(employee.fullName) === key);
  return matches.length === 1 ? matches[0].id : null;
}
