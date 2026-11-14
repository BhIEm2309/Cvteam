import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentOrganizationService } from '../../common/current-organization.service';
import { activeAssignmentWhere, todayAsDate } from '../../common/assignments';
import { PositionItem } from './position-item';
import { CreatePositionInput, UpdatePositionInput } from './position-input';
import { buildOrgChart, OrgChartResponse } from './org-chart';

// Indica a Prisma qué traer junto con cada cargo: nombre del área, título del cargo superior
// y cantidad de asignaciones vigentes en la fecha indicada.
function includeDetails(today: Date) {
  return {
    department: { select: { name: true } },
    parentPosition: { select: { title: true } },
    _count: { select: { positionAssignments: { where: activeAssignmentWhere(today) } } },
  } satisfies Prisma.PositionInclude;
}

type PositionRow = Prisma.PositionGetPayload<{ include: ReturnType<typeof includeDetails> }>;

@Injectable()
export class PositionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currentOrganization: CurrentOrganizationService,
  ) {}

  // Lista los cargos activos (no archivados), ordenados por título.
  async listPositions(): Promise<PositionItem[]> {
    const organization = await this.currentOrganization.getCurrentOrganization();

    const positions = await this.prisma.position.findMany({
      where: { organizationId: organization.organizationId, archivedAt: null },
      orderBy: { title: 'asc' },
      include: includeDetails(todayAsDate()),
    });

    return positions.map((position) => this.toItem(position));
  }

  // Organigrama actual con datos reales (reglas en org-chart.ts).
  async getOrgChart(): Promise<OrgChartResponse> {
    const organization = await this.currentOrganization.getCurrentOrganization();
    const organizationId = organization.organizationId;
    const today = todayAsDate();

    const positions = await this.prisma.position.findMany({
      where: { organizationId, archivedAt: null },
      select: {
        id: true,
        title: true,
        parentPositionId: true,
        criticality: true,
        targetHeadcount: true,
        department: { select: { name: true } },
        positionAssignments: {
          // Solo personas activas (no archivadas) con una asignación vigente hoy.
          where: { ...activeAssignmentWhere(today), employee: { archivedAt: null } },
          select: { employeeId: true, allocationPercent: true, employee: { select: { fullName: true } } },
        },
      },
    });

    return buildOrgChart(
      organization.organizationName,
      today.toISOString().slice(0, 10),
      positions.map((position) => ({
        id: position.id,
        title: position.title,
        departmentName: position.department.name,
        parentPositionId: position.parentPositionId,
        criticality: position.criticality,
        targetHeadcount: position.targetHeadcount,
        assignments: position.positionAssignments.map((assignment) => ({
          employeeId: assignment.employeeId,
          fullName: assignment.employee.fullName,
          allocationPercent: Number(assignment.allocationPercent),
        })),
      })),
    );
  }

  // Devuelve un cargo activo por su id.
  async getPosition(positionId: string): Promise<PositionItem> {
    const organization = await this.currentOrganization.getCurrentOrganization();
    const position = await this.findActivePosition(organization.organizationId, positionId);
    return this.toItem(position);
  }

  // Crea un cargo.
  async createPosition(input: CreatePositionInput): Promise<PositionItem> {
    const organization = await this.currentOrganization.getCurrentOrganization();
    const organizationId = organization.organizationId;

    await this.assertActiveDepartment(organizationId, input.departmentId);
    if (input.parentPositionId !== null) {
      await this.findActivePosition(organizationId, input.parentPositionId, 'El cargo superior no existe.');
    }

    try {
      const position = await this.prisma.$transaction(async (tx) => {
        const created = await tx.position.create({
          data: { organizationId, ...input },
          include: includeDetails(todayAsDate()),
        });

        await tx.auditEvent.create({
          data: {
            organizationId,
            actorMemberId: organization.memberId,
            action: 'POSITION_CREATED',
            entityType: 'Position',
            entityId: created.id,
            changes: { code: input.code, title: input.title },
          },
        });

        return created;
      });

      return this.toItem(position);
    } catch (error) {
      this.throwIfDuplicateCode(error, input.code);
      throw error;
    }
  }

  // Edita un cargo. Solo cambia los campos que vienen en input.
  async updatePosition(positionId: string, input: UpdatePositionInput): Promise<PositionItem> {
    const organization = await this.currentOrganization.getCurrentOrganization();
    const organizationId = organization.organizationId;
    await this.findActivePosition(organizationId, positionId);

    if (input.departmentId !== undefined) {
      await this.assertActiveDepartment(organizationId, input.departmentId);
    }
    if (input.parentPositionId !== undefined && input.parentPositionId !== null) {
      await this.findActivePosition(organizationId, input.parentPositionId, 'El cargo superior no existe.');
      await this.assertNoCycle(organizationId, positionId, input.parentPositionId);
    }

    try {
      const position = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.position.update({
          where: { id: positionId },
          data: input,
          include: includeDetails(todayAsDate()),
        });

        await tx.auditEvent.create({
          data: {
            organizationId,
            actorMemberId: organization.memberId,
            action: 'POSITION_UPDATED',
            entityType: 'Position',
            entityId: positionId,
            changes: { ...input },
          },
        });

        return updated;
      });

      return this.toItem(position);
    } catch (error) {
      if (input.code !== undefined) {
        this.throwIfDuplicateCode(error, input.code);
      }
      throw error;
    }
  }

  // "Eliminar" un cargo: se archiva (deja de aparecer en el listado, pero se conserva el registro).
  async archivePosition(positionId: string): Promise<PositionItem> {
    const organization = await this.currentOrganization.getCurrentOrganization();
    const organizationId = organization.organizationId;
    await this.findActivePosition(organizationId, positionId);
    const today = todayAsDate();

    // No se archiva un cargo que todavía tiene cargos a su cargo o personas asignadas.
    const activeSubordinates = await this.prisma.position.count({
      where: { organizationId, parentPositionId: positionId, archivedAt: null },
    });
    if (activeSubordinates > 0) {
      throw new ConflictException(`No se puede archivar: el cargo tiene ${activeSubordinates} cargo(s) a su cargo.`);
    }

    const activeAssignments = await this.prisma.positionAssignment.count({
      where: { organizationId, positionId, ...activeAssignmentWhere(today) },
    });
    if (activeAssignments > 0) {
      throw new ConflictException(`No se puede archivar: el cargo tiene ${activeAssignments} persona(s) asignada(s).`);
    }

    const position = await this.prisma.$transaction(async (tx) => {
      const archived = await tx.position.update({
        where: { id: positionId },
        data: { archivedAt: new Date() },
        include: includeDetails(today),
      });

      await tx.auditEvent.create({
        data: {
          organizationId,
          actorMemberId: organization.memberId,
          action: 'POSITION_ARCHIVED',
          entityType: 'Position',
          entityId: positionId,
        },
      });

      return archived;
    });

    return this.toItem(position);
  }

  // ---------- Funciones de apoyo ----------

  // Busca un cargo activo de la organización. Si no existe (o es de otra empresa), responde 404.
  private async findActivePosition(
    organizationId: string,
    positionId: string,
    notFoundMessage = 'El cargo no existe.',
  ): Promise<PositionRow> {
    const position = await this.prisma.position.findFirst({
      where: { id: positionId, organizationId, archivedAt: null },
      include: includeDetails(todayAsDate()),
    });

    if (position === null) {
      throw new NotFoundException(notFoundMessage);
    }

    return position;
  }

  private async assertActiveDepartment(organizationId: string, departmentId: string): Promise<void> {
    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, organizationId, archivedAt: null },
      select: { id: true },
    });
    if (department === null) {
      throw new NotFoundException('El área no existe.');
    }
  }

  // La base solo impide que un cargo sea su propio superior. Aquí se revisa toda la cadena hacia arriba:
  // si desde el nuevo superior se llega al mismo cargo, se formaría un ciclo (A jefe de B y B jefe de A).
  private async assertNoCycle(organizationId: string, positionId: string, newParentId: string): Promise<void> {
    let currentId: string | null = newParentId;
    const visited = new Set<string>();

    while (currentId !== null) {
      if (currentId === positionId) {
        throw new BadRequestException('Ese cargo superior formaría un ciclo en el organigrama.');
      }
      if (visited.has(currentId)) {
        // Ya existía un ciclo en los datos (no debería pasar); se corta para no quedar en un bucle.
        break;
      }
      visited.add(currentId);

      const parent: { parentPositionId: string | null } | null = await this.prisma.position.findFirst({
        where: { id: currentId, organizationId },
        select: { parentPositionId: true },
      });
      currentId = parent?.parentPositionId ?? null;
    }
  }

  // P2002 es el error de Prisma cuando se repite un valor único (aquí, el código del cargo).
  private throwIfDuplicateCode(error: unknown, code: string): void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException(`Ya existe un cargo con el código "${code}" (puede estar archivado).`);
    }
  }

  private toItem(position: PositionRow): PositionItem {
    return {
      id: position.id,
      code: position.code,
      title: position.title,
      description: position.description,
      departmentId: position.departmentId,
      departmentName: position.department.name,
      parentPositionId: position.parentPositionId,
      parentPositionTitle: position.parentPosition ? position.parentPosition.title : null,
      targetHeadcount: position.targetHeadcount,
      currentHeadcount: position._count.positionAssignments,
      criticality: position.criticality,
      createdAt: position.createdAt,
      updatedAt: position.updatedAt,
    };
  }
}
