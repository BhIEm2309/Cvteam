import { BadRequestException } from '@nestjs/common';
import { readOptionalText, readRequiredUuid, toObject } from '../../common/input';

export const MAX_REQUIREMENTS = 50;
const MAX_SKILL_NAME = 160;
const CATEGORIES = ['TECHNICAL', 'BEHAVIORAL'] as const;

// Un requisito del cargo. La competencia se indica por id (del catálogo) o por nombre (se busca o se crea).
export interface RequirementInput {
  skillId: string | null;
  newSkill: { name: string; category: (typeof CATEGORIES)[number] } | null;
  requiredLevel: number | null;
  isMandatory: boolean;
  weight: number;
}

// Lee el cuerpo de PUT /api/positions/:id/skills: { requirements: [...] }. Reemplaza todos los requisitos.
export function parsePositionSkillsInput(body: unknown): RequirementInput[] {
  const data = toObject(body);
  if (!Array.isArray(data.requirements)) {
    throw new BadRequestException('El campo "requirements" debe ser una lista (vacía para quitar todos los requisitos).');
  }
  if (data.requirements.length > MAX_REQUIREMENTS) {
    throw new BadRequestException(`Un cargo admite como máximo ${MAX_REQUIREMENTS} requisitos.`);
  }

  return data.requirements.map((raw, index) => {
    const item = toObject(raw);
    const field = (name: string) => `requirements[${index}].${name}`;

    let skillId: string | null = null;
    let newSkill: RequirementInput['newSkill'] = null;
    if (item.skillId !== undefined && item.skillId !== null) {
      skillId = readRequiredUuid(item.skillId, field('skillId'));
    } else {
      const name = readOptionalText(item.name, field('name'), MAX_SKILL_NAME);
      if (name === null || name === undefined) {
        throw new BadRequestException(`Indica "${field('skillId')}" o el nombre de la competencia en "${field('name')}".`);
      }
      if (!CATEGORIES.includes(item.category as (typeof CATEGORIES)[number])) {
        throw new BadRequestException(`El campo "${field('category')}" debe ser TECHNICAL o BEHAVIORAL.`);
      }
      newSkill = { name: name.replace(/\s+/g, ' '), category: item.category as (typeof CATEGORIES)[number] };
    }

    const requiredLevel = item.requiredLevel ?? null;
    if (requiredLevel !== null && (typeof requiredLevel !== 'number' || !Number.isInteger(requiredLevel) || requiredLevel < 1 || requiredLevel > 5)) {
      throw new BadRequestException(`El campo "${field('requiredLevel')}" debe ser un entero de 1 a 5 o null.`);
    }

    const isMandatory = item.isMandatory ?? true;
    if (typeof isMandatory !== 'boolean') {
      throw new BadRequestException(`El campo "${field('isMandatory')}" debe ser true o false.`);
    }

    // weight es Decimal(5,2) en la base: mayor que 0, hasta 100, con dos decimales como máximo.
    const weight = item.weight ?? 1;
    if (typeof weight !== 'number' || !Number.isFinite(weight) || weight <= 0 || weight > 100 || Math.abs(Math.round(weight * 100) - weight * 100) > 1e-9) {
      throw new BadRequestException(`El campo "${field('weight')}" debe ser un número mayor que 0 y hasta 100 (máximo 2 decimales).`);
    }

    return { skillId, newSkill, requiredLevel: requiredLevel as number | null, isMandatory, weight };
  });
}
