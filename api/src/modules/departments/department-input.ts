import { BadRequestException } from '@nestjs/common';
import { readOptionalText, readOptionalUuid, readRequiredText, toObject } from '../../common/input';

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
