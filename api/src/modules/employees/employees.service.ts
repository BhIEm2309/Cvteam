import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentOrganizationService } from '../../common/current-organization.service';
import { activeAssignmentWhere, todayAsDate } from '../../common/assignments';
import { EmployeeItem } from './employee-item';
import { CreateEmployeeInput, UpdateEmployeeInput } from './employee-input';
import { setCurrentPosition } from './employee-assignment';

// Indica a Prisma que traiga las asignaciones vigentes (con cargo y área) de cada persona.
function includeCurrentPositions(today: Date) {
  return {
    positionAssignments: {
      where: activeAssignmentWhere(today),
      orderBy: { startDate: 'asc' },
      include: {
        position: { select: { id: true, title: true, department: { select: { id: true, name: true } } } },
      },
    },
  } satisfies Prisma.EmployeeInclude;
}

type EmployeeRow = Prisma.EmployeeGetPayload<{ include: ReturnType<typeof includeCurrentPositions> }>;

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currentOrganization: CurrentOrganizationService,
  ) {}

  // Lista las personas no archivadas, ordenadas por nombre.
  async listEmployees(): Promise<EmployeeItem[]> {
    const organization = await this.currentOrganization.getCurrentOrganization();

    const employees = await this.prisma.employee.findMany({
      where: { organizationId: organization.organizationId, archivedAt: null },
      orderBy: { fullName: 'asc' },
      include: includeCurrentPositions(todayAsDate()),
    });

    return employees.map((employee) => this.toItem(employee));
  }

  // Devuelve una persona no archivada por su id.
  async getEmployee(employeeId: string): Promise<EmployeeItem> {
    const organization = await this.currentOrganization.getCurrentOrganization();
    const employee = await this.findActiveEmployee(organization.organizationId, employeeId);
    return this.toItem(employee);
  }

  // Crea una persona y, si viene positionId, le asigna ese cargo desde hoy.
  async createEmployee(input: CreateEmployeeInput): Promise<EmployeeItem> {
    const organization = await this.currentOrganization.getCurrentOrganization();
    const organizationId = organization.organizationId;
    const today = todayAsDate();
    const { positionId, ...data } = input;

    if (positionId !== null) {
      await this.assertActivePosition(organizationId, positionId);
    }

    try {
      const employee = await this.prisma.$transaction(async (tx) => {
        const created = await tx.employee.create({ data: { organizationId, ...data } });

        if (positionId !== null) {
          await setCurrentPosition(tx, organizationId, created.id, positionId, today);
        }

        await tx.auditEvent.create({
          data: {
            organizationId,
            actorMemberId: organization.memberId,
            action: 'EMPLOYEE_CREATED',
            entityType: 'Employee',
            entityId: created.id,
            changes: { fullName: input.fullName, positionId },
          },
        });

        return tx.employee.findUniqueOrThrow({ where: { id: created.id }, include: includeCurrentPositions(today) });
      });

      return this.toItem(employee);
    } catch (error) {
      this.throwIfDuplicateCode(error, input.employeeCode);
      throw error;
    }
  }

  // Edita una persona. Si viene positionId, cambia su cargo vigente (cierra el anterior y abre el nuevo).
  async updateEmployee(employeeId: string, input: UpdateEmployeeInput): Promise<EmployeeItem> {
    const organization = await this.currentOrganization.getCurrentOrganization();
    const organizationId = organization.organizationId;
    const today = todayAsDate();
    await this.findActiveEmployee(organizationId, employeeId);
    const { positionId, ...data } = input;

    if (positionId !== undefined && positionId !== null) {
      await this.assertActivePosition(organizationId, positionId);
    }

    try {
      const employee = await this.prisma.$transaction(async (tx) => {
        if (Object.keys(data).length > 0) {
          await tx.employee.update({ where: { id: employeeId }, data });
        }

        let assignmentChange: string | undefined;
        if (positionId !== undefined) {
          assignmentChange = await setCurrentPosition(tx, organizationId, employeeId, positionId, today);
        }

        await tx.auditEvent.create({
          data: {
            organizationId,
            actorMemberId: organization.memberId,
            action: 'EMPLOYEE_UPDATED',
            entityType: 'Employee',
            entityId: employeeId,
            changes: { ...input, assignmentChange },
          },
        });

        return tx.employee.findUniqueOrThrow({ where: { id: employeeId }, include: includeCurrentPositions(today) });
      });

      return this.toItem(employee);
    } catch (error) {
      this.throwIfDuplicateCode(error, input.employeeCode);
      throw error;
    }
  }

  // "Eliminar" una persona: se archiva. Antes hay que quitarle el cargo (PATCH con "positionId": null),
  // para que la historia de asignaciones quede cerrada de forma explícita.
  async archiveEmployee(employeeId: string): Promise<EmployeeItem> {
    const organization = await this.currentOrganization.getCurrentOrganization();
    const organizationId = organization.organizationId;
    const today = todayAsDate();
    const existing = await this.findActiveEmployee(organizationId, employeeId);

    if (existing.positionAssignments.length > 0) {
      throw new ConflictException(
        'No se puede archivar: la persona tiene un cargo vigente. Primero quítale el cargo (PATCH con "positionId": null).',
      );
    }

    const employee = await this.prisma.$transaction(async (tx) => {
      const archived = await tx.employee.update({
        where: { id: employeeId },
        data: { archivedAt: new Date() },
        include: includeCurrentPositions(today),
      });

      await tx.auditEvent.create({
        data: {
          organizationId,
          actorMemberId: organization.memberId,
          action: 'EMPLOYEE_ARCHIVED',
          entityType: 'Employee',
          entityId: employeeId,
        },
      });

      return archived;
    });

    return this.toItem(employee);
  }

  // ---------- Funciones de apoyo ----------

  private async findActiveEmployee(organizationId: string, employeeId: string): Promise<EmployeeRow> {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, organizationId, archivedAt: null },
      include: includeCurrentPositions(todayAsDate()),
    });

    if (employee === null) {
      throw new NotFoundException('La persona no existe.');
    }

    return employee;
  }

  private async assertActivePosition(organizationId: string, positionId: string): Promise<void> {
    const position = await this.prisma.position.findFirst({
      where: { id: positionId, organizationId, archivedAt: null },
      select: { id: true },
    });
    if (position === null) {
      throw new NotFoundException('El cargo no existe.');
    }
  }

  // P2002: el código de trabajador ya existe en la organización.
  private throwIfDuplicateCode(error: unknown, employeeCode: string | null | undefined): void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException(`Ya existe una persona con el código "${employeeCode ?? ''}" (puede estar archivada).`);
    }
  }

  private toItem(employee: EmployeeRow): EmployeeItem {
    return {
      id: employee.id,
      employeeCode: employee.employeeCode,
      fullName: employee.fullName,
      email: employee.email,
      weeklyCapacityHours: employee.weeklyCapacityHours === null ? null : Number(employee.weeklyCapacityHours),
      status: employee.status,
      currentPositions: employee.positionAssignments.map((assignment) => ({
        positionId: assignment.position.id,
        positionTitle: assignment.position.title,
        departmentId: assignment.position.department.id,
        departmentName: assignment.position.department.name,
        allocationPercent: Number(assignment.allocationPercent),
        startDate: assignment.startDate.toISOString().slice(0, 10),
      })),
      createdAt: employee.createdAt,
      updatedAt: employee.updatedAt,
    };
  }
}
