// Convierte la respuesta de la IA en propuestas de competencias, descartando lo que no se puede respaldar.
// Funciones puras (sin base de datos): se prueban en test/extraction.test.ts.
import { normalizeKey } from '../org-chart-import/org-chart-csv';
import { CvExtraction } from './cv-extraction-schema';

export const MAX_PROPOSALS_PER_CV = 100;
const MAX_NAME_LENGTH = 160;
const MAX_EXCERPT_LENGTH = 1000;

export interface ProposalDraft {
  name: string;
  category: 'TECHNICAL' | 'BEHAVIORAL';
  level: number | null;
  excerpt: string;
}

export interface DiscardedSkill {
  name: string;
  reason: string;
}

export interface ProposalResult {
  candidateName: string | null;
  proposals: ProposalDraft[];
  discarded: DiscardedSkill[];
}

// Para comparar textos: minúsculas y espacios simples. No quita tildes ni cambia palabras.
function normalizeForMatch(text: string): string {
  return text.toLocaleLowerCase('es').replace(/\s+/g, ' ').trim();
}

/**
 * Revisa cada competencia de la IA:
 * - el fragmento citado debe aparecer en el texto del CV (si no, la IA lo inventó o lo alteró);
 * - no se repiten competencias (sin importar mayúsculas ni tildes);
 * - el nivel fuera de 1 a 5 se deja vacío.
 */
export function buildProposals(extraction: CvExtraction, cvText: string): ProposalResult {
  const searchableText = normalizeForMatch(cvText);
  const seen = new Set<string>();
  const proposals: ProposalDraft[] = [];
  const discarded: DiscardedSkill[] = [];

  for (const skill of extraction.skills) {
    const name = skill.name.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH);
    const excerpt = skill.excerpt.replace(/\s+/g, ' ').trim();
    const key = normalizeKey(name);

    if (name === '' || key === '') {
      discarded.push({ name: skill.name, reason: 'Sin nombre.' });
      continue;
    }
    if (excerpt === '' || excerpt.length > MAX_EXCERPT_LENGTH) {
      discarded.push({ name, reason: 'Sin fragmento del CV que la respalde.' });
      continue;
    }
    if (!searchableText.includes(normalizeForMatch(excerpt))) {
      discarded.push({ name, reason: 'El fragmento citado no aparece en el CV.' });
      continue;
    }
    if (seen.has(key)) {
      discarded.push({ name, reason: 'Repetida.' });
      continue;
    }
    if (proposals.length >= MAX_PROPOSALS_PER_CV) {
      discarded.push({ name, reason: `Se superó el máximo de ${MAX_PROPOSALS_PER_CV} competencias por CV.` });
      continue;
    }

    seen.add(key);
    const level = skill.level !== null && Number.isInteger(skill.level) && skill.level >= 1 && skill.level <= 5 ? skill.level : null;
    proposals.push({ name, category: skill.category, level, excerpt });
  }

  const candidateName = extraction.candidateName?.replace(/\s+/g, ' ').trim() || null;
  return { candidateName, proposals, discarded };
}
