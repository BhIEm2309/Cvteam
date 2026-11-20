import { normalizeKey } from '../org-chart-import/org-chart-csv';

// Sugerencias de competencias equivalentes del catálogo (por ejemplo, "Gestión de proyectos PMBOK" ≈ "Gestión de
// proyectos"). Es lógica determinista, sin IA, probada en test/skill-similarity.test.ts.
//
// SOLO SUGIERE: el ajuste al cargo cruza competencias por nombre exacto (sin mayúsculas, tildes ni espacios). Para
// que una competencia del CV cuente para un requisito, quien revisa debe elegir el nombre del catálogo. Así la
// decisión de "son la misma" la toma siempre una persona.

// Mínimo parecido para sugerir (0 a 1).
export const SIMILARITY_MIN_SCORE = 0.5;
export const MAX_SUGGESTIONS = 3;
// Dos palabras largas que comparten este inicio se consideran la misma ("mantención" y "mantenimiento",
// "compresor" y "compresores").
const SHARED_PREFIX = 6;

// Palabras que no aportan al significado de una competencia.
const STOPWORDS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'en', 'y', 'e', 'o', 'u', 'a', 'para', 'con', 'por', 'al', 'un', 'una']);

export function skillTokens(name: string): string[] {
  return normalizeKey(name)
    .replace(/[^a-z0-9ñ+#]+/g, ' ')
    .split(' ')
    .filter((token) => token !== '' && !STOPWORDS.has(token));
}

function sameWord(a: string, b: string): boolean {
  if (a === b) return true;
  return a.length >= SHARED_PREFIX && b.length >= SHARED_PREFIX && a.slice(0, SHARED_PREFIX) === b.slice(0, SHARED_PREFIX);
}

// Reemplaza una sigla por las palabras que abrevia, si están en el otro nombre ("pm" → "plant maintenance").
function expandAcronyms(tokens: string[], other: string[]): string[] {
  const result: string[] = [];
  for (const token of tokens) {
    if (other.some((word) => sameWord(word, token)) || token.length < 2 || token.length > 5) {
      result.push(token);
      continue;
    }
    let expansion: string[] | null = null;
    for (let start = 0; start + token.length <= other.length && expansion === null; start++) {
      const run = other.slice(start, start + token.length);
      if (run.map((word) => word[0]).join('') === token) {
        expansion = run;
      }
    }
    result.push(...(expansion ?? [token]));
  }
  return result;
}

// Parecido entre dos nombres de competencia, de 0 a 1 (palabras en común sobre palabras distintas).
export function skillSimilarity(a: string, b: string): number {
  if (normalizeKey(a) === normalizeKey(b)) return 1;
  const rawA = skillTokens(a);
  const rawB = skillTokens(b);
  const tokensA = expandAcronyms(rawA, rawB);
  const tokensB = expandAcronyms(rawB, rawA);
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const free = [...tokensB];
  let matches = 0;
  for (const token of tokensA) {
    const index = free.findIndex((word) => sameWord(word, token));
    if (index >= 0) {
      matches++;
      free.splice(index, 1);
    }
  }
  return matches / (tokensA.length + tokensB.length - matches);
}

export interface CatalogSkill {
  id: string;
  name: string;
  category: 'TECHNICAL' | 'BEHAVIORAL';
}

export interface CatalogMatch {
  // Competencia del catálogo con el mismo nombre (ya cuenta para los requisitos que la usan).
  exact: CatalogSkill | null;
  // Competencias parecidas, de la más a la menos parecida. Vacío si hay coincidencia exacta.
  similar: (CatalogSkill & { score: number })[];
}

export function matchCatalog(name: string, catalog: CatalogSkill[]): CatalogMatch {
  const key = normalizeKey(name);
  const exact = catalog.find((skill) => normalizeKey(skill.name) === key) ?? null;
  if (exact) {
    return { exact, similar: [] };
  }
  const similar = catalog
    .map((skill) => ({ ...skill, score: Math.round(skillSimilarity(name, skill.name) * 100) / 100 }))
    .filter((skill) => skill.score >= SIMILARITY_MIN_SCORE)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'es'))
    .slice(0, MAX_SUGGESTIONS);
  return { exact: null, similar };
}
