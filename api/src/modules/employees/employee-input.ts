import { BadRequestException } from '@nestjs/common';
import { EmployeeStatus } from '@prisma/client';
import { readOptionalEnum, readOptionalText, readOptionalUuid, readRequiredText, toObject } from '../../common/input';

const STATUSES: readonly EmployeeStatus[] = ['ACTIVE', 'INACTIVE'];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Datos para crear una persona. positionId (opcional) le asigna un cargo desde hoy.
export interface CreateEmployeeInput {
  employeeCode: string | null;
  fullName: string;
  email: string | null;
  weeklyCapacityHours: number | null;
  status: EmployeeStatus;
  positionId: string | null;
}

// Datos para editar una persona. positionId: cambia su cargo vigente (null = dejarla sin cargo).
export interface UpdateEmployeeInput {
  employeeCode?: string | null;
  fullName?: string;
  email?: string | null;
  weeklyCapacityHours?: number | null;
  status?: EmployeeStatus;
  positionId?: string | null;
}

// Revisa el cuerpo de POST /api/employees.
export function parseCreateEmployeeInput(body: unknown): CreateEmployeeInput {
  const data = toObject(body);

  return {
    employeeCode: readOptionalText(data.employeeCode, 'employeeCode', 60) ?? null,
    fullName: readRequiredText(data.fullName, 'fullName', 200),
    email: readEmail(data.email) ?? null,
    weeklyCapacityHours: readHours(data.weeklyCapacityHours) ?? null,
    status: readOptionalEnum(data.status, 'status', STATUSES) ?? 'ACTIVE',
    positionId: readOptionalUuid(data.positionId, 'positionId') ?? null,
  };
}

// Revisa el cuerpo de PATCH /api/employees/:id.
export function parseUpdateEmployeeInput(body: unknown): UpdateEmployeeInput {
  const data = toObject(body);
  const input: UpdateEmployeeInput = {};

  if (data.employeeCode !== undefined) {
    input.employeeCode = readOptionalText(data.employeeCode, 'employeeCode', 60);
  }
  if (data.fullName !== undefined) {
    input.fullName = readRequiredText(data.fullName, 'fullName', 200);
  }
  if (data.email !== undefined) {
    input.email = readEmail(data.email);
  }
  if (data.weeklyCapacityHours !== undefined) {
    input.weeklyCapacityHours = readHours(data.weeklyCapacityHours);
  }
  if (data.status !== undefined) {
    input.status = readOptionalEnum(data.status, 'status', STATUSES);
  }
  if (data.positionId !== undefined) {
    input.positionId = readOptionalUuid(data.positionId, 'positionId');
  }

  if (Object.keys(input).length === 0) {
    throw new BadRequestException(
      'Debes enviar al menos un campo para editar: employeeCode, fullName, email, weeklyCapacityHours, status o positionId.',
    );
  }

  return input;
}

function readEmail(value: unknown): string | null | undefined {
  const email = readOptionalText(value, 'email', 254);
  if (email && !EMAIL_PATTERN.test(email)) {
    throw new BadRequestException('El campo "email" no tiene un formato válido.');
  }
  return email;
}

// Horas semanales de trabajo (la base exige > 0).
function readHours(value: unknown): number | null | undefined {
  if (value === undefined || value === null) {
    return value;
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 168) {
    throw new BadRequestException('El campo "weeklyCapacityHours" debe ser un número mayor que 0 y hasta 168.');
  }
  return value;
}
