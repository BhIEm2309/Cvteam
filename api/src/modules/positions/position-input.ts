import { BadRequestException } from '@nestjs/common';
import { Severity } from '@prisma/client';
import {
  readOptionalEnum,
  readOptionalInteger,
  readOptionalText,
  readOptionalUuid,
  readRequiredText,
  readRequiredUuid,
  toObject,
} from '../../common/input';

const SEVERITIES: readonly Severity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

// Datos para crear un cargo.
export interface CreatePositionInput {
  code: string;
  title: string;
  description: string | null;
  departmentId: string;
  parentPositionId: string | null;
  targetHeadcount: number;
  criticality: Severity;
}

// Datos para editar un cargo. Cada campo es opcional: solo se cambia lo que viene.
export interface UpdatePositionInput {
  code?: string;
  title?: string;
  description?: string | null;
  departmentId?: string;
  parentPositionId?: string | null;
  targetHeadcount?: number;
  criticality?: Severity;
}

// Revisa el cuerpo de POST /api/positions.
export function parseCreatePositionInput(body: unknown): CreatePositionInput {
  const data = toObject(body);

  return {
    code: readRequiredText(data.code, 'code', 40),
    title: readRequiredText(data.title, 'title', 160),
    description: readOptionalText(data.description, 'description') ?? null,
    departmentId: readRequiredUuid(data.departmentId, 'departmentId'),
    parentPositionId: readOptionalUuid(data.parentPositionId, 'parentPositionId') ?? null,
    targetHeadcount: readOptionalInteger(data.targetHeadcount, 'targetHeadcount', 1, 10_000) ?? 1,
    criticality: readOptionalEnum(data.criticality, 'criticality', SEVERITIES) ?? 'MEDIUM',
  };
}

// Revisa el cuerpo de PATCH /api/positions/:id.
export function parseUpdatePositionInput(body: unknown): UpdatePositionInput {
  const data = toObject(body);
  const input: UpdatePositionInput = {};

  if (data.code !== undefined) {
    input.code = readRequiredText(data.code, 'code', 40);
  }
  if (data.title !== undefined) {
    input.title = readRequiredText(data.title, 'title', 160);
  }
  if (data.description !== undefined) {
    input.description = readOptionalText(data.description, 'description');
  }
  if (data.departmentId !== undefined) {
    input.departmentId = readRequiredUuid(data.departmentId, 'departmentId');
  }
  if (data.parentPositionId !== undefined) {
    input.parentPositionId = readOptionalUuid(data.parentPositionId, 'parentPositionId');
  }
  if (data.targetHeadcount !== undefined) {
    input.targetHeadcount = readOptionalInteger(data.targetHeadcount, 'targetHeadcount', 1, 10_000);
  }
  if (data.criticality !== undefined) {
    input.criticality = readOptionalEnum(data.criticality, 'criticality', SEVERITIES);
  }

  if (Object.keys(input).length === 0) {
    throw new BadRequestException(
      'Debes enviar al menos un campo para editar: code, title, description, departmentId, parentPositionId, targetHeadcount o criticality.',
    );
  }

  return input;
}
