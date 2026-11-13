import { Prisma } from '@prisma/client';
import { activeAssignmentWhere } from '../../common/assignments';

export type AssignmentChange = 'sin-cambios' | 'asignado' | 'cambio-de-cargo' | 'sin-cargo';

// Deja a una persona con un solo cargo vigente (o sin cargo si newPositionId es null), desde la fecha "today".
// Lo usan employees.service.ts y el importador de organigrama, siempre dentro de una transacción.
//
// - Si ya tiene ese cargo vigente, no cambia nada.
// - Las asignaciones vigentes a otros cargos se cierran con end_date = today (end_date es exclusivo).
// - La base exige end_date > start_date: una asignación que empezó hoy no se puede cerrar hoy,
//   así que se borra (es una corrección del mismo día, no historia).
export async function setCurrentPosition(
  tx: Prisma.TransactionClient,
  organizationId: string,
  employeeId: string,
  newPositionId: string | null,
  today: Date,
): Promise<AssignmentChange> {
  const activeAssignments = await tx.positionAssignment.findMany({
    where: { organizationId, employeeId, ...activeAssignmentWhere(today) },
    select: { id: true, positionId: true, startDate: true },
  });

  const alreadyAssigned = newPositionId !== null && activeAssignments.some((a) => a.positionId === newPositionId);
  const toClose = activeAssignments.filter((a) => a.positionId !== newPositionId);

  if (alreadyAssigned && toClose.length === 0) {
    return 'sin-cambios';
  }

  for (const assignment of toClose) {
    if (assignment.startDate.getTime() >= today.getTime()) {
      await tx.positionAssignment.delete({ where: { id: assignment.id } });
    } else {
      await tx.positionAssignment.update({ where: { id: assignment.id }, data: { endDate: today } });
    }
  }

  if (newPositionId === null) {
    return activeAssignments.length === 0 ? 'sin-cambios' : 'sin-cargo';
  }

  if (!alreadyAssigned) {
    await tx.positionAssignment.create({
      data: { organizationId, employeeId, positionId: newPositionId, startDate: today },
    });
  }

  return activeAssignments.length === 0 ? 'asignado' : 'cambio-de-cargo';
}
