import { BadRequestException } from '@nestjs/common';

// Funciones comunes para revisar el cuerpo de las solicitudes (JSON) y responder 400 con mensajes en español.

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function toObject(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new BadRequestException('El cuerpo de la solicitud debe ser un objeto JSON.');
  }
  return body as Record<string, unknown>;
}

// Texto obligatorio: sin espacios al inicio/final, no vacío y con largo máximo.
export function readRequiredText(value: unknown, fieldName: string, maxLength: number): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new BadRequestException(`El campo "${fieldName}" es obligatorio.`);
  }

  const text = value.trim();
  if (text.length > maxLength) {
    throw new BadRequestException(`El campo "${fieldName}" admite como máximo ${maxLength} caracteres.`);
  }

  return text;
}

// Texto opcional: null o "" significan "sin valor". undefined significa "no vino".
export function readOptionalText(value: unknown, fieldName: string, maxLength?: number): string | null | undefined {
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
  if (maxLength !== undefined && text.length > maxLength) {
    throw new BadRequestException(`El campo "${fieldName}" admite como máximo ${maxLength} caracteres.`);
  }
  return text === '' ? null : text;
}

// UUID obligatorio.
export function readRequiredUuid(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || !isUuid(value)) {
    throw new BadRequestException(`El campo "${fieldName}" debe ser un id válido.`);
  }
  return value;
}

// UUID opcional: null significa "sin valor".
export function readOptionalUuid(value: unknown, fieldName: string): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== 'string' || !isUuid(value)) {
    throw new BadRequestException(`El campo "${fieldName}" debe ser un id válido o null.`);
  }
  return value;
}

// Número entero opcional dentro de un rango.
export function readOptionalInteger(value: unknown, fieldName: string, min: number, max: number): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new BadRequestException(`El campo "${fieldName}" debe ser un número entero entre ${min} y ${max}.`);
  }
  return value;
}

// Valor opcional que debe ser uno de los permitidos.
export function readOptionalEnum<T extends string>(value: unknown, fieldName: string, allowed: readonly T[]): T | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new BadRequestException(`El campo "${fieldName}" debe ser uno de: ${allowed.join(', ')}.`);
  }
  return value as T;
}
