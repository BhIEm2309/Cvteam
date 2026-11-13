import { Prisma } from '@prisma/client';

// Las asignaciones de cargo usan fechas sin hora (columna DATE). "Hoy" se calcula en la zona horaria de Chile,
// para que una asignación hecha a las 22:00 en Chile no quede con la fecha del día siguiente (UTC).
// Prisma representa una fecha DATE como un Date a las 00:00 UTC de ese día.
export function todayAsDate(timeZone = 'America/Santiago'): Date {
  // en-CA formatea como AAAA-MM-DD.
  const text = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return new Date(`${text}T00:00:00.000Z`);
}

// Condición de una asignación vigente en una fecha: ya empezó y no ha terminado.
// end_date es exclusivo: una asignación con end_date = hoy ya no está vigente hoy.
export function activeAssignmentWhere(date: Date): Prisma.PositionAssignmentWhereInput {
  return {
    startDate: { lte: date },
    OR: [{ endDate: null }, { endDate: { gt: date } }],
  };
}
