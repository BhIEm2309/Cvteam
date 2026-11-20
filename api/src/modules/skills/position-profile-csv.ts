import { parse } from 'csv-parse/sync';
import { decodeCsv, detectDelimiter, normalizeKey, OrgChartError, OrgChartFileError } from '../org-chart-import/org-chart-csv';
import { MAX_REQUIREMENTS } from './position-skills-input';

// Lectura y validación del CSV de perfiles de cargo (competencias requeridas por cargo). Funciones puras, sin base
// de datos, probadas en api/test/position-profile-csv.test.ts. El servicio (skills.service.ts) usa el resultado.
//
// Una fila = una competencia requerida por un cargo. Columnas (mayúsculas, tildes y espacios no importan):
//   cargo         obligatorio  nombre del cargo (debe existir: se importa antes el organigrama)
//   area          obligatorio  área del cargo (un cargo es la combinación área + cargo, igual que en el organigrama)
//   competencia   obligatorio  nombre de la competencia (se busca en el catálogo; si no existe, se crea)
//   categoria     opcional     tecnica o blanda. Obligatoria solo si la competencia todavía no existe
//   nivel_minimo  opcional     entero de 1 a 5; vacío = basta con tenerla
//   obligatoria   opcional     si / no (por defecto si)
//   peso          opcional     número mayor que 0 y hasta 100, con 2 decimales como máximo (por defecto 1)
//
// Cada cargo que aparece en el archivo queda con EXACTAMENTE las competencias del archivo (se reemplazan las que
// tenía). Los cargos que no aparecen no cambian.

export const MAX_PROFILE_ROWS = 5000;
const LIMITS = { cargo: 160, area: 160, competencia: 160 } as const;

type ColumnName = 'cargo' | 'area' | 'competencia' | 'categoria' | 'nivel_minimo' | 'obligatoria' | 'peso';

const HEADER_ALIASES: Record<ColumnName, string[]> = {
  cargo: ['cargo', 'puesto'],
  area: ['area', 'departamento', 'unidad'],
  competencia: ['competencia', 'habilidad', 'skill'],
  categoria: ['categoria', 'tipo'],
  nivel_minimo: ['nivel minimo', 'nivel', 'nivel requerido'],
  obligatoria: ['obligatoria', 'obligatorio', 'requerida'],
  peso: ['peso', 'ponderacion'],
};

const CATEGORY_VALUES: Record<string, 'TECHNICAL' | 'BEHAVIORAL'> = {
  tecnica: 'TECHNICAL',
  tecnico: 'TECHNICAL',
  technical: 'TECHNICAL',
  blanda: 'BEHAVIORAL',
  conductual: 'BEHAVIORAL',
  behavioral: 'BEHAVIORAL',
};
const YES = ['si', 's', 'true', '1', 'x'];
const NO = ['no', 'n', 'false', '0'];

export interface ProfileRow {
  line: number;
  cargo: string;
  area: string;
  competencia: string;
  category: 'TECHNICAL' | 'BEHAVIORAL' | null;
  requiredLevel: number | null;
  isMandatory: boolean;
  weight: number;
}

// Requisitos agrupados por cargo (clave área|cargo, la misma que usa el importador de organigrama).
export interface ProfilePlan {
  positions: { key: string; title: string; department: string; lines: number[]; requirements: ProfileRow[] }[];
}

export type ProfileParseResult =
  | { ok: true; plan: ProfilePlan; rowCount: number }
  | { ok: false; errors: OrgChartError[]; rowCount: number };

export function readProfileRows(text: string): { rows: ProfileRow[]; errors: OrgChartError[] } {
  let records: { record: string[]; info: { lines: number } }[];
  try {
    records = parse(text, {
      delimiter: detectDelimiter(text),
      bom: true,
      info: true,
      relax_column_count: true,
      skip_empty_lines: true,
      trim: true,
    }) as unknown as { record: string[]; info: { lines: number } }[];
  } catch (error) {
    const detail = error instanceof Error ? error.message : '';
    throw new OrgChartFileError(`No se pudo leer el CSV. Revisa las comillas del archivo. (${detail})`);
  }
  if (records.length === 0) {
    throw new OrgChartFileError('El archivo está vacío.');
  }

  const columns = mapHeaders(records[0].record);
  const dataRecords = records.slice(1).filter(({ record }) => record.some((cell) => cell !== ''));
  if (dataRecords.length === 0) {
    throw new OrgChartFileError('El archivo solo tiene encabezados: no hay competencias para importar.');
  }
  if (dataRecords.length > MAX_PROFILE_ROWS) {
    throw new OrgChartFileError(`El archivo tiene ${dataRecords.length} filas; el máximo es ${MAX_PROFILE_ROWS}.`);
  }

  const rows: ProfileRow[] = [];
  const errors: OrgChartError[] = [];

  for (const { record, info } of dataRecords) {
    const line = info.lines;
    const cell = (column: ColumnName) => {
      const index = columns[column];
      return index === undefined ? '' : (record[index] ?? '').replace(/\s+/g, ' ').trim();
    };
    const problems: string[] = [];

    const text = { cargo: cell('cargo'), area: cell('area'), competencia: cell('competencia') };
    const missing = (Object.keys(text) as (keyof typeof text)[]).filter((field) => text[field] === '');
    if (missing.length > 0) {
      problems.push(`Falta ${missing.join(', ')}.`);
    }
    const tooLong = (Object.keys(LIMITS) as (keyof typeof LIMITS)[]).filter((field) => text[field].length > LIMITS[field]);
    if (tooLong.length > 0) {
      problems.push(`Texto demasiado largo en: ${tooLong.map((field) => `${field} (máx. ${LIMITS[field]})`).join(', ')}.`);
    }

    const categoryText = normalizeKey(cell('categoria'));
    const category = categoryText === '' ? null : (CATEGORY_VALUES[categoryText] ?? undefined);
    if (category === undefined) {
      problems.push(`categoria debe ser "tecnica" o "blanda" (llegó "${cell('categoria')}").`);
    }

    const levelText = cell('nivel_minimo');
    const level = levelText === '' ? null : /^\d+$/.test(levelText) ? Number(levelText) : NaN;
    if (level !== null && !(Number.isInteger(level) && level >= 1 && level <= 5)) {
      problems.push(`nivel_minimo debe ser un entero de 1 a 5 o vacío (llegó "${levelText}").`);
    }

    const mandatoryText = normalizeKey(cell('obligatoria'));
    let isMandatory = true;
    if (mandatoryText !== '') {
      if (YES.includes(mandatoryText)) isMandatory = true;
      else if (NO.includes(mandatoryText)) isMandatory = false;
      else problems.push(`obligatoria debe ser "si" o "no" (llegó "${cell('obligatoria')}").`);
    }

    // Acepta coma decimal ("1,5"), como escribe Excel en español.
    const weightText = cell('peso').replace(',', '.');
    const weight = weightText === '' ? 1 : /^\d+(\.\d{1,2})?$/.test(weightText) ? Number(weightText) : NaN;
    if (!(Number.isFinite(weight) && weight > 0 && weight <= 100)) {
      problems.push(`peso debe ser un número mayor que 0 y hasta 100, con 2 decimales como máximo (llegó "${cell('peso')}").`);
    }

    if (problems.length > 0) {
      errors.push({ lines: [line], message: problems.join(' ') });
      continue;
    }
    rows.push({
      line,
      ...text,
      category: category ?? null,
      requiredLevel: level,
      isMandatory,
      weight,
    });
  }

  return { rows, errors };
}

function mapHeaders(headers: string[]): Partial<Record<ColumnName, number>> {
  const columns: Partial<Record<ColumnName, number>> = {};
  headers.forEach((header, index) => {
    const normalized = normalizeKey(header.replace(/_/g, ' '));
    for (const column of Object.keys(HEADER_ALIASES) as ColumnName[]) {
      if (columns[column] === undefined && HEADER_ALIASES[column].includes(normalized)) {
        columns[column] = index;
      }
    }
  });
  const missing = (['cargo', 'area', 'competencia'] as const).filter((column) => columns[column] === undefined);
  if (missing.length > 0) {
    throw new OrgChartFileError(
      `Faltan columnas obligatorias: ${missing.join(', ')}. Encabezados esperados: cargo, area, competencia, categoria, nivel_minimo, obligatoria y peso (estos cuatro opcionales).`,
    );
  }
  return columns;
}

// Agrupa por cargo y revisa repetidos y el máximo de requisitos por cargo.
export function buildProfilePlan(rows: ProfileRow[]): { plan: ProfilePlan; errors: OrgChartError[] } {
  const errors: OrgChartError[] = [];
  const byPosition = new Map<string, ProfileRow[]>();
  for (const row of rows) {
    const key = `${normalizeKey(row.area)}|${normalizeKey(row.cargo)}`;
    byPosition.set(key, [...(byPosition.get(key) ?? []), row]);
  }

  const positions: ProfilePlan['positions'] = [];
  for (const [key, group] of byPosition) {
    const bySkill = new Map<string, ProfileRow[]>();
    for (const row of group) {
      const skillKey = normalizeKey(row.competencia);
      bySkill.set(skillKey, [...(bySkill.get(skillKey) ?? []), row]);
    }
    for (const repeated of [...bySkill.values()].filter((list) => list.length > 1)) {
      errors.push({
        lines: repeated.map((row) => row.line),
        message: `La competencia "${repeated[0].competencia}" aparece ${repeated.length} veces en el cargo "${group[0].cargo}" de "${group[0].area}". Deja una sola fila.`,
      });
    }
    if (bySkill.size > MAX_REQUIREMENTS) {
      errors.push({
        lines: group.map((row) => row.line),
        message: `El cargo "${group[0].cargo}" de "${group[0].area}" tiene ${bySkill.size} competencias; el máximo es ${MAX_REQUIREMENTS}.`,
      });
    }
    positions.push({ key, title: group[0].cargo, department: group[0].area, lines: group.map((row) => row.line), requirements: group });
  }

  errors.sort((a, b) => (a.lines[0] ?? 0) - (b.lines[0] ?? 0));
  return { plan: { positions }, errors };
}

// Todo junto: archivo → requisitos agrupados por cargo, o la lista de errores.
export function parsePositionProfileCsv(buffer: Buffer): ProfileParseResult {
  const { rows, errors: rowErrors } = readProfileRows(decodeCsv(buffer));
  const rowCount = rows.length + rowErrors.length;
  if (rowErrors.length > 0) {
    return { ok: false, errors: rowErrors, rowCount };
  }
  const { plan, errors } = buildProfilePlan(rows);
  return errors.length > 0 ? { ok: false, errors, rowCount } : { ok: true, plan, rowCount };
}
