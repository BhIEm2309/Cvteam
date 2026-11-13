import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { config } from '../config';

// Datos de la organización y del miembro que está usando la API.
export interface CurrentOrganization {
  organizationId: string;
  organizationName: string;
  memberId: string;
}

/**
 * Indica con qué organización y con qué miembro se está trabajando.
 *
 * MODO DEMOSTRACIÓN: todavía no existe login. Por ahora siempre se usa el OWNER activo de la
 * organización configurada en DEMO_ORGANIZATION_SLUG (por defecto "demo", creada por prisma/seed.ts).
 * La organización la decide el servidor; el navegador nunca puede elegir otra.
 *
 * Cuando se agregue el login, solo hay que cambiar este servicio para que lea el usuario de la sesión.
 * Los módulos que lo usan no necesitan cambios.
 */
@Injectable()
export class CurrentOrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrentOrganization(): Promise<CurrentOrganization> {
    const member = await this.prisma.organizationMember.findFirst({
      where: {
        role: 'OWNER',
        status: 'ACTIVE',
        organization: { slug: config.demoOrganizationSlug },
      },
      include: { organization: true },
    });

    if (member === null) {
      throw new ServiceUnavailableException(
        `No existe la organización de demostración "${config.demoOrganizationSlug}". Ejecuta "pnpm db:seed" en la carpeta api.`,
      );
    }

    return {
      organizationId: member.organizationId,
      organizationName: member.organization.name,
      memberId: member.id,
    };
  }
}
