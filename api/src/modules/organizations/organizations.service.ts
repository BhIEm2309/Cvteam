import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentOrganizationService } from '../../common/current-organization.service';
import { OrganizationItem } from './organization-item';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currentOrganization: CurrentOrganizationService,
  ) {}

  // Lista las organizaciones donde el usuario actual es miembro activo.
  // Sin login, el usuario es siempre el OWNER de la organización de demostración (ver CurrentOrganizationService).
  async listOrganizations(): Promise<OrganizationItem[]> {
    const current = await this.currentOrganization.getCurrentOrganization();

    const organizations = await this.prisma.organization.findMany({
      where: {
        archivedAt: null,
        members: { some: { userId: current.userId, status: 'ACTIVE' } },
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        industry: true,
        _count: {
          select: {
            employees: { where: { archivedAt: null, status: 'ACTIVE' } },
            positions: { where: { archivedAt: null } },
          },
        },
      },
    });

    return organizations.map((organization) => ({
      id: organization.id,
      name: organization.name,
      taxId: null,
      sector: organization.industry,
      employees: organization._count.employees,
      activeRoles: organization._count.positions,
    }));
  }
}
