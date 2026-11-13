import { BadRequestException } from '@nestjs/common';

// Datos para crear un área.
export interface CreateDepartmentInput {
  code: string;
  name: string;
  description: string | null;
  parentDepartmentId: string | null;
}

// Datos para editar un área. Cada campo es opcional: solo se cambia lo que viene.
export interface UpdateDepartmentInput {
  code?: string;
  name?: string;
  description?: string | null;
  parentDepartmentId?: string | null;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Revisa el cuerpo de POST /api/departments.
export function parseCreateDepartmentInput(body: unknown): CreateDepartmentInput {
  const data = toObject(body);

  return {
    code: readRequiredText(data.code, 'code', 40),
    name: readRequiredText(data.name, 'name', 160),
    description: readOptionalText(data.description, 'description') ?? null,
    parentDepartmentId: readOptionalUuid(data.parentDepartmentId, 'parentDepartmentId') ?? null,
  };
}

// Revisa el cuerpo de PATCH /api/departments/:id.
export function parseUpdateDepartmentInput(body: unknown): UpdateDepartmentInput {
  const data = toObject(body);
  const input: UpdateDepartmentInput = {};

  if (data.code !== undefined) {
    input.code = readRequiredText(data.code, 'code', 40);
  }
  if (data.name !== undefined) {
    input.name = readRequiredText(data.name, 'name', 160);
  }
  if (data.description !== undefined) {
    input.description = readOptionalText(data.description, 'description');
  }
  if (data.parentDepartmentId !== undefined) {
    input.parentDepartmentId = readOptionalUuid(data.parentDepartmentId, 'parentDepartmentId');
  }

  if (Object.keys(input).length === 0) {
    throw new BadRequestException('Debes enviar al menos un campo para editar: code, name, description o parentDepartmentId.');
  }

  return input;
}

// ---------- Funciones de apoyo ----------

function toObject(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new BadRequestException('El cuerpo de la solicitud debe ser un objeto JSON.');
  }
  return body as Record<string, unknown>;
}

// Texto obligatorio: sin espacios al inicio/final, no vacío y con largo máximo.
function readRequiredText(value: unknown, fieldName: string, maxLength: number): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new BadRequestException(`El campo "${fieldName}" es obligatorio.`);
  }

  const text = value.trim();
  if (text.length > maxLength) {
    throw new BadRequestException(`El campo "${fieldName}" admite como máximo ${maxLength} caracteres.`);
  }

  return text;
}

// Texto opcional: null o "" significan "sin valor".
function readOptionalText(value: unknown, fieldName: string): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new BadRequestException(`El campo "${fieldName}" debe ser texto.`);
  }

  const text = value.trim();
  return text === '' ? null : text;
}

// UUID opcional: null significa "sin valor".
function readOptionalUuid(value: unknown, fieldName: string): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new BadRequestException(`El campo "${fieldName}" debe ser un id válido o null.`);
  }
  return value;
}
