import { z } from 'zod';

// Contrato del JSON que debe devolver la IA al analizar un CV.
// Si cambia la forma, hay que subir OUTPUT_SCHEMA_VERSION (se guarda en extraction_runs).
export const OUTPUT_SCHEMA_VERSION = 'cv-skills-v1';

export const SKILL_CATEGORIES = ['TECHNICAL', 'BEHAVIORAL'] as const;

// Las descripciones las lee el modelo: explican qué va en cada campo.
export const CvExtractionSchema = z.object({
  candidateName: z
    .string()
    .nullable()
    .describe('Nombre completo de la persona tal como aparece en el CV, o null si no aparece.'),
  skills: z
    .array(
      z.object({
        name: z
          .string()
          .describe('Nombre corto y normalizado de la competencia, en español. Ejemplo: "Mantención de compresores".'),
        category: z
          .enum(SKILL_CATEGORIES)
          .describe('TECHNICAL para conocimientos y herramientas; BEHAVIORAL para habilidades blandas.'),
        level: z
          .number()
          .int()
          .nullable()
          .describe('Nivel de 1 a 5 solo si el CV lo justifica (años, certificaciones, cargos). null si no hay base.'),
        excerpt: z
          .string()
          .describe('Fragmento copiado textualmente del CV, sin cambiar ninguna palabra, que respalda la competencia.'),
      }),
    )
    .describe('Competencias que el CV respalda con un fragmento textual. No inventar competencias.'),
});

export type CvExtraction = z.infer<typeof CvExtractionSchema>;
export type ExtractedSkill = CvExtraction['skills'][number];
