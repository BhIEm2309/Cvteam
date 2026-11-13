import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentOrganizationService } from '../../common/current-organization.service';
import { DepartmentItem } from './department-item';
import { CreateDepartmentInput, UpdateDepartmentInput } from './department-input';

// Un área tal como viene de la base, junto con el nombre de su área superior.
interface DepartmentRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  parentDepartmentId: string | null;
  createdAt: Date;
  updatedAt: Date;
  parentDepartment: { name: string } | null;
}

// Indica a Prisma que traiga también el nombre del área superior.
const INCLUDE_PARENT_NAME = {
  parentDepartment: { select: { name: true } },
} as const;

@Injectable()
export class DepartmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currentOrganization: CurrentOrganizationService,
  ) {}

  // Lista las áreas activas (no archivadas), ordenadas por nombre.
  async listDepartments(): Promise<DepartmentItem[]> {
    const organization = await this.currentOrganization.getCurrentOrganization();

    const departments = await this.prisma.department.findMany({
      where: { organizationId: organization.organizationId, archivedAt: null },
      orderBy: { name: 'asc' },
      include: INCLUDE_PARENT_NAME,
    });

    return departments.map((department) => this.toItem(department));
  }

  // Devuelve un área activa por su id.
  async getDepartment(departmentId: string): Promise<DepartmentItem> {
    const organization = await this.currentOrganization.getCurrentOrganization();
    const department = await this.findActiveDepartment(organization.organizationId, departmentId);
    return this.toItem(department);
  }

  // Crea un área.
  async createDepartment(input: CreateDepartmentInput): Promise<DepartmentItem> {
    const organization = await this.currentOrganization.getCurrentOrganization();

    // El área superior, si viene, debe existir y estar activa.
    if (input.parentDepartmentId !== null) {
      await this.findActiveDepartment(organization.organizationId, input.parentDepartmentId, 'El área superior no existe.');
    }

    try {
      const department = await this.prisma.$transaction(async (tx) => {
        const created = await tx.department.create({
          data: {
            organizationId: organization.organizationId,
            code: input.code,
            name: input.name,
            description: input.description,
            parentDepartmentId: input.parentDepartmentId,
          },
          include: INCLUDE_PARENT_NAME,
        });

        await tx.auditEvent.create({
          data: {
            organizationId: organization.organizationId,
            actorMemberId: organization.memberId,
            action: 'DEPARTMENT_CREATED',
            entityType: 'Department',
            entityId: created.id,
            changes: { code: input.code, name: input.name },
          },
        });

        return created;
      });

      return this.toItem(department);
    } catch (error) {
      this.throwIfDuplicateCode(error, input.code);
      throw error;
    }
  }

  // Edita un área. Solo cambia los campos que vienen en input.
  async updateDepartment(departmentId: string, input: UpdateDepartmentInput): Promise<DepartmentItem> {
    const organization = await this.currentOrganization.getCurrentOrganization();
    await this.findActiveDepartment(organization.organizationId, departmentId);

    if (input.parentDepartmentId !== undefined && input.parentDepartmentId !== null) {
      if (input.parentDepartmentId === departmentId) {
        throw new BadRequestException('Un área no puede ser su propia área superior.');
      }
      await this.findActiveDepartment(organization.organizationId, input.parentDepartmentId, 'El área superior no existe.');
      await this.assertNoCycle(organization.organizationId, departmentId, input.parentDepartmentId);
    }

    try {
      const department = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.department.update({
          where: { id: departmentId },
          data: input,
          include: INCLUDE_PARENT_NAME,
        });

        await tx.auditEvent.create({
          data: {
            organizationId: organization.organizationId,
            actorMemberId: organization.memberId,
            action: 'DEPARTMENT_UPDATED',
            entityType: 'Department',
            entityId: departmentId,
            changes: { ...input },
          },
        });

        return updated;
      });

      return this.toItem(department);
    } catch (error) {
      if (input.code !== undefined) {
        this.throwIfDuplicateCode(error, input.code);
      }
      throw error;
    }
  }

  // "Eliminar" un área: se archiva (deja de aparecer en el listado, pero se conserva el registro).
  async archiveDepartment(departmentId: string): Promise<DepartmentItem> {
    const organization = await this.currentOrganization.getCurrentOrganization();
    await this.findActiveDepartment(organization.organizationId, departmentId);

    // No se archiva un área que todavía tiene subáreas o puestos activos.
    const activeChildren = await this.prisma.department.count({
      where: { organizationId: organization.organizationId, parentDepartmentId: departmentId, archivedAt: null },
    });
    if (activeChildren > 0) {
      throw new ConflictException(`No se puede archivar: el área tiene ${activeChildren} subárea(s) activa(s).`);
    }

    const activePositions = await this.prisma.position.count({
      where: { organizationId: organization.organizationId, departmentId: departmentId, archivedAt: null },
    });
    if (activePositions > 0) {
      throw new ConflictException(`No se puede archivar: el área tiene ${activePositions} puesto(s) activo(s).`);
    }

    const department = await this.prisma.$transaction(async (tx) => {
      const archived = await tx.department.update({
        where: { id: departmentId },
        data: { archivedAt: new Date() },
        include: INCLUDE_PARENT_NAME,
      });

      await tx.auditEvent.create({
        data: {
          organizationId: organization.organizationId,
          actorMemberId: organization.memberId,
          action: 'DEPARTMENT_ARCHIVED',
          entityType: 'Department',
          entityId: departmentId,
        },
      });

      return archived;
    });

    return this.toItem(department);
  }

  // ---------- Funciones de apoyo ----------

  // Busca un área activa de la organización. Si no existe (o es de otra empresa), responde 404.
  private async findActiveDepartment(
    organizationId: string,
    departmentId: string,
    notFoundMessage = 'El área no existe.',
  ): Promise<DepartmentRow> {
    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, organizationId: organizationId, archivedAt: null },
      include: INCLUDE_PARENT_NAME,
    });

    if (department === null) {
      throw new NotFoundException(notFoundMessage);
    }

    return department;
  }

  // Sube desde la nueva área superior hacia arriba. Si en el camino aparece el área que se edita,
  // el cambio formaría un ciclo (por ejemplo A → B → A) y se rechaza.
  private async assertNoCycle(organizationId: string, departmentId: string, newParentId: string): Promise<void> {
    let currentId: string | null = newParentId;
    const visited = new Set<string>();

    while (currentId !== null) {
      if (currentId === departmentId) {
        throw new BadRequestException('Esa área superior formaría un ciclo entre áreas.');
      }
      if (visited.has(currentId)) {
        // Ya existía un ciclo en los datos (no debería pasar); se corta para no quedar en un bucle.
        break;
      }
      visited.add(currentId);

      const parent: { parentDepartmentId: string | null } | null = await this.prisma.department.findFirst({
        where: { id: currentId, organizationId },
        select: { parentDepartmentId: true },
      });
      currentId = parent?.parentDepartmentId ?? null;
    }
  }

  // P2002 es el error de Prisma cuando se repite un valor único (aquí, el código del área).
  private throwIfDuplicateCode(error: unknown, code: string): void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException(`Ya existe un área con el código "${code}" (puede estar archivada).`);
    }
  }

  private toItem(department: DepartmentRow): DepartmentItem {
    return {
      id: department.id,
      code: department.code,
      name: department.name,
      description: department.description,
      parentDepartmentId: department.parentDepartmentId,
      parentDepartmentName: department.parentDepartment ? department.parentDepartment.name : null,
      createdAt: department.createdAt,
      updatedAt: department.updatedAt,
    };
  }
}
