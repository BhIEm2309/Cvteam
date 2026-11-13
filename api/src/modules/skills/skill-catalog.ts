import { generateCode, normalizeKey } from '../org-chart-import/org-chart-csv';

// skills.code admite 80 caracteres.
const MAX_SKILL_CODE = 80;

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
