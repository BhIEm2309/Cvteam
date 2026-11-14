import { parse } from 'csv-parse/sync';

// Lectura y validación del CSV de organigrama. Son funciones puras (sin base de datos), probadas en
// api/test/org-chart-csv.test.ts. El servicio de importación usa el resultado para guardar en la base.
//
// Columnas (la primera fila son los encabezados; mayúsculas, tildes y espacios no importan):
//   nombre        obligatorio  nombre completo de la persona
//   cargo         obligatorio  nombre del cargo
//   area          obligatorio  área a la que pertenece el cargo
//   jefe_directo  opcional     nombre (o código) del jefe directo; vacío para quien está más arriba
//   codigo        opcional     código o RUT de la persona; sirve para distinguir nombres repetidos
//   dotacion_objetivo opcional cuántas personas debería tener el cargo (entero >= 1). Si no viene, se usa la
//                              cantidad de personas del archivo con ese cargo.

export const MAX_ROWS = 5000;

// Mismo máximo que acepta la API de cargos (positions/position-input.ts).
export const MAX_HEADCOUNT = 10_000;

const LIMITS = { nombre: 200, cargo: 160, area: 160, codigo: 60 } as const;

// Nombres de encabezado aceptados para cada columna (ya normalizados con normalizeKey).
const HEADER_ALIASES: Record<ColumnName, string[]> = {
  nombre: ['nombre', 'nombre completo', 'persona', 'trabajador', 'colaborador'],
  cargo: ['cargo', 'puesto'],
  area: ['area', 'departamento', 'unidad'],
  jefe_directo: ['jefe directo', 'jefe', 'jefatura', 'reporta a'],
  codigo: ['codigo', 'rut', 'codigo trabajador', 'id'],
  dotacion_objetivo: ['dotacion objetivo', 'dotacion'],
};

type ColumnName = 'nombre' | 'cargo' | 'area' | 'jefe_directo' | 'codigo' | 'dotacion_objetivo';

// Una fila del archivo, ya limpia (sin espacios sobrantes).
export interface OrgChartRow {
  line: number;
  nombre: string;
  cargo: string;
  area: string;
  jefeDirecto: string | null;
  codigo: string | null;
  // Dotación objetivo declarada para el cargo de esta fila (null = no se indicó).
  dotacionObjetivo: number | null;
}

// Error asociado a una o más filas del archivo (lines vacío = error general del archivo).
// Las advertencias usan la misma forma: se muestran, pero no impiden importar.
export interface OrgChartError {
  lines: number[];
  message: string;
}

// Resultado listo para guardar: áreas, cargos (con su cargo superior) y personas (con su cargo).
export interface OrgChartPlan {
  departments: { key: string; name: string }[];
  positions: {
    key: string;
    title: string;
    departmentKey: string;
    parentKey: string | null;
    // Valor que se guarda: el declarado o, si no hay, la cantidad de personas del archivo (mínimo 1).
    targetHeadcount: number;
    declaredHeadcount: number | null;
    personCount: number;
  }[];
  employees: { key: string; fullName: string; code: string | null; positionKey: string; line: number }[];
}

export type OrgChartParseResult =
  | { ok: true; plan: OrgChartPlan; warnings: OrgChartError[]; rowCount: number }
  | { ok: false; errors: OrgChartError[]; rowCount: number };

// ---------- Paso 1: archivo → texto ----------

// Excel en Windows a veces guarda en "ANSI" (Windows-1252) en vez de UTF-8: los acentos llegarían rotos.
// Se rechaza el archivo con un mensaje claro en vez de guardar nombres dañados.
export function decodeCsv(buffer: Buffer): string {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    throw new OrgChartFileError(
      'El archivo no está en UTF-8. En Excel usa "Guardar como" → "CSV UTF-8 (delimitado por comas)".',
    );
  }
  // Quita el BOM que agrega Excel al inicio.
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export class OrgChartFileError extends Error {}

// Excel en español separa con ";" y en inglés con ",". Se elige el que más aparece en los encabezados.
export function detectDelimiter(text: string): ',' | ';' {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const semicolons = (firstLine.match(/;/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  return semicolons > commas ? ';' : ',';
}

// ---------- Paso 2: texto → filas ----------

export function readRows(text: string): { rows: OrgChartRow[]; errors: OrgChartError[] } {
  let records: { record: string[]; info: { lines: number } }[];
  try {
    records = parse(text, {
      delimiter: detectDelimiter(text),
      bom: true,
      info: true,
      relax_column_count: true,
      skip_empty_lines: true,
      trim: true,
      // Con info: true cada registro viene como { record, info }; los tipos de csv-parse no lo reflejan.
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
    throw new OrgChartFileError('El archivo solo tiene encabezados: no hay personas para importar.');
  }
  if (dataRecords.length > MAX_ROWS) {
    throw new OrgChartFileError(`El archivo tiene ${dataRecords.length} filas; el máximo es ${MAX_ROWS}.`);
  }

  const rows: OrgChartRow[] = [];
  const errors: OrgChartError[] = [];

  for (const { record, info } of dataRecords) {
    const line = info.lines;
    const cell = (column: ColumnName) => {
      const index = columns[column];
      return index === undefined ? '' : (record[index] ?? '').trim();
    };

    const row: OrgChartRow = {
      line,
      nombre: collapseSpaces(cell('nombre')),
      cargo: collapseSpaces(cell('cargo')),
      area: collapseSpaces(cell('area')),
      jefeDirecto: collapseSpaces(cell('jefe_directo')) || null,
      codigo: collapseSpaces(cell('codigo')) || null,
      dotacionObjetivo: null,
    };

    const missing = (['nombre', 'cargo', 'area'] as const).filter((field) => row[field] === '');
    if (missing.length > 0) {
      errors.push({ lines: [line], message: `Falta ${missing.join(', ')}.` });
      continue;
    }

    const tooLong = (Object.keys(LIMITS) as (keyof typeof LIMITS)[]).filter((field) => {
      const value = row[field];
      return value !== null && value.length > LIMITS[field];
    });
    if (tooLong.length > 0) {
      errors.push({
        lines: [line],
        message: `Texto demasiado largo en: ${tooLong.map((field) => `${field} (máx. ${LIMITS[field]})`).join(', ')}.`,
      });
      continue;
    }

    const headcount = cell('dotacion_objetivo');
    if (headcount !== '') {
      const value = /^\d+$/.test(headcount) ? Number(headcount) : NaN;
      if (!Number.isInteger(value) || value < 1 || value > MAX_HEADCOUNT) {
        errors.push({
          lines: [line],
          message: `dotacion_objetivo debe ser un número entero entre 1 y ${MAX_HEADCOUNT} (llegó "${headcount}").`,
        });
        continue;
      }
      row.dotacionObjetivo = value;
    }

    rows.push(row);
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

  const missing = (['nombre', 'cargo', 'area'] as const).filter((column) => columns[column] === undefined);
  if (missing.length > 0) {
    throw new OrgChartFileError(
      `Faltan columnas obligatorias: ${missing.join(', ')}. Encabezados esperados: nombre, cargo, area, jefe_directo (opcional), codigo (opcional), dotacion_objetivo (opcional).`,
    );
  }

  return columns;
}

// ---------- Paso 3: filas → organigrama validado ----------

export function buildPlan(rows: OrgChartRow[]): { plan: OrgChartPlan; errors: OrgChartError[]; warnings: OrgChartError[] } {
  const errors: OrgChartError[] = [];
  const warnings: OrgChartError[] = [];

  // Identidad de cada persona: su código si lo tiene; si no, su nombre.
  const personKey = (row: OrgChartRow) => (row.codigo ? `codigo:${normalizeKey(row.codigo)}` : `nombre:${normalizeKey(row.nombre)}`);

  // 1. Personas repetidas.
  const byPerson = groupBy(rows, personKey);
  for (const [key, group] of byPerson) {
    if (group.length > 1) {
      const how = key.startsWith('codigo:') ? `el código "${group[0].codigo}"` : `el nombre "${group[0].nombre}"`;
      errors.push({
        lines: group.map((row) => row.line),
        message: `La persona con ${how} aparece ${group.length} veces. Si son personas distintas, agrega la columna "codigo".`,
      });
    }
  }

  // 2. Resolver el jefe directo de cada fila: primero por código, luego por nombre.
  const byCode = groupBy(rows.filter((row) => row.codigo), (row) => normalizeKey(row.codigo ?? ''));
  const byName = groupBy(rows, (row) => normalizeKey(row.nombre));
  const bossOf = new Map<OrgChartRow, OrgChartRow | null>();

  for (const row of rows) {
    if (row.jefeDirecto === null) {
      bossOf.set(row, null);
      continue;
    }
    const wanted = normalizeKey(row.jefeDirecto);
    const candidates = byCode.get(wanted) ?? byName.get(wanted) ?? [];

    if (candidates.length === 0) {
      errors.push({ lines: [row.line], message: `El jefe directo "${row.jefeDirecto}" no aparece como persona en el archivo.` });
    } else if (candidates.length > 1) {
      errors.push({
        lines: [row.line],
        message: `Hay ${candidates.length} personas llamadas "${row.jefeDirecto}". Indica el jefe por su código.`,
      });
    } else if (candidates[0] === row) {
      errors.push({ lines: [row.line], message: 'Una persona no puede ser su propio jefe directo.' });
    } else {
      bossOf.set(row, candidates[0]);
    }
  }

  // 3. Cargos: un cargo es la combinación área + nombre del cargo. Su cargo superior es el cargo del jefe.
  const positionKey = (row: OrgChartRow) => `${normalizeKey(row.area)}|${normalizeKey(row.cargo)}`;
  const byPosition = groupBy(rows, positionKey);
  const parentOf = new Map<string, string | null>();

  for (const [key, group] of byPosition) {
    // Cargo superior que indica cada fila (undefined = la fila tiene un jefe con error, se ignora aquí).
    const parents = new Map<string | null, number[]>();
    for (const row of group) {
      if (!bossOf.has(row)) {
        continue;
      }
      const boss = bossOf.get(row) ?? null;
      const parentKey = boss === null ? null : positionKey(boss);
      parents.set(parentKey, [...(parents.get(parentKey) ?? []), row.line]);
    }

    if (parents.size > 1) {
      const detail = [...parents.entries()]
        .map(([parentKey, lines]) => `${parentKey === null ? 'sin jefe' : describePosition(parentKey, byPosition)} (filas ${lines.join(', ')})`)
        .join('; ');
      errors.push({
        lines: group.map((row) => row.line),
        message: `El cargo "${group[0].cargo}" de "${group[0].area}" depende de jefaturas distintas: ${detail}. Usa nombres de cargo distintos (por ejemplo "Técnico senior - Turno A") o corrige el jefe.`,
      });
      continue;
    }

    const parentKey = parents.size === 1 ? [...parents.keys()][0] : null;
    if (parentKey === key) {
      errors.push({
        lines: group.map((row) => row.line),
        message: `El cargo "${group[0].cargo}" de "${group[0].area}" quedaría como su propio cargo superior: la persona y su jefe tienen el mismo cargo y área. Usa nombres de cargo distintos.`,
      });
      continue;
    }
    parentOf.set(key, parentKey);
  }

  // 4. Ciclos entre cargos (por ejemplo, el jefe de A tiene como jefe a alguien de A).
  for (const start of parentOf.keys()) {
    const path: string[] = [];
    let current: string | null | undefined = start;
    while (current !== null && current !== undefined && !path.includes(current)) {
      path.push(current);
      current = parentOf.get(current);
    }
    // Se informa una sola vez por ciclo: desde el cargo con la clave menor.
    if (current === start && start === [...path].sort()[0]) {
      const cycle = path.map((key) => describePosition(key, byPosition)).join(' → ');
      errors.push({
        lines: path.flatMap((key) => (byPosition.get(key) ?? []).map((row) => row.line)),
        message: `Los cargos forman un ciclo de jefaturas: ${cycle} → ${describePosition(start, byPosition)}.`,
      });
    }
  }

  // 5. Dotación objetivo de cada cargo. Puede venir en una o varias filas del cargo, pero siempre con el mismo valor.
  const headcountOf = new Map<string, { declared: number | null; persons: number }>();
  for (const [key, group] of byPosition) {
    const declaredRows = group.filter((row) => row.dotacionObjetivo !== null);
    const values = new Set(declaredRows.map((row) => row.dotacionObjetivo));
    if (values.size > 1) {
      errors.push({
        lines: declaredRows.map((row) => row.line),
        message: `El cargo "${group[0].cargo}" de "${group[0].area}" tiene dotaciones objetivo distintas (${[...values].join(', ')}). Deja un solo valor.`,
      });
      continue;
    }
    const declared = declaredRows[0]?.dotacionObjetivo ?? null;
    headcountOf.set(key, { declared, persons: group.length });
    if (declared !== null && declared < group.length) {
      warnings.push({
        lines: group.map((row) => row.line),
        message: `El cargo "${group[0].cargo}" de "${group[0].area}" tiene dotación objetivo ${declared}, pero el archivo le asigna ${group.length} personas: quedará con sobredotación.`,
      });
    }
  }

  // 6. Armar el resultado (solo se usa si no hubo errores).
  const departments = [...groupBy(rows, (row) => normalizeKey(row.area)).entries()].map(([key, group]) => ({
    key,
    name: group[0].area,
  }));
  const positions = [...byPosition.entries()].map(([key, group]) => {
    const headcount = headcountOf.get(key) ?? { declared: null, persons: group.length };
    return {
      key,
      title: group[0].cargo,
      departmentKey: normalizeKey(group[0].area),
      parentKey: parentOf.get(key) ?? null,
      targetHeadcount: headcount.declared ?? Math.max(headcount.persons, 1),
      declaredHeadcount: headcount.declared,
      personCount: headcount.persons,
    };
  });
  const employees = rows.map((row) => ({
    key: personKey(row),
    fullName: row.nombre,
    code: row.codigo,
    positionKey: positionKey(row),
    line: row.line,
  }));

  const byFirstLine = (a: OrgChartError, b: OrgChartError) => (a.lines[0] ?? 0) - (b.lines[0] ?? 0);
  errors.sort(byFirstLine);
  warnings.sort(byFirstLine);
  return { plan: { departments, positions, employees }, errors, warnings };
}

// Todo junto: archivo → organigrama validado, o la lista de errores.
export function parseOrgChartCsv(buffer: Buffer): OrgChartParseResult {
  const { rows, errors: rowErrors } = readRows(decodeCsv(buffer));
  const rowCount = rows.length + rowErrors.length;

  if (rowErrors.length > 0) {
    return { ok: false, errors: rowErrors, rowCount };
  }

  const { plan, errors, warnings } = buildPlan(rows);
  return errors.length > 0 ? { ok: false, errors, rowCount } : { ok: true, plan, warnings, rowCount };
}

// ---------- Utilidades ----------

// Clave para comparar textos sin importar mayúsculas, tildes ni espacios repetidos.
export function normalizeKey(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// Código a partir de un nombre ("Mantención Planta" → "MANTENCION-PLANTA"), sin repetir los ya usados.
export function generateCode(name: string, taken: Set<string>, maxLength = 40): string {
  const base =
    name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, maxLength - 4)
      .replace(/-+$/g, '') || 'SIN-NOMBRE';

  let code = base;
  for (let suffix = 2; taken.has(code); suffix++) {
    code = `${base}-${suffix}`;
  }
  taken.add(code);
  return code;
}

function collapseSpaces(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function groupBy<T>(items: T[], keyOf: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return groups;
}

function describePosition(key: string, byPosition: Map<string, OrgChartRow[]>): string {
  const row = byPosition.get(key)?.[0];
  return row ? `${row.cargo} (${row.area})` : key;
}
