import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentOrganizationService } from '../../common/current-organization.service';
import { SkillCatalog } from './skill-catalog';
import { RequirementInput } from './position-skills-input';

export interface SkillItem {
  id: string;
  code: string;
  name: string;
  category: 'TECHNICAL' | 'BEHAVIORAL';
  // Personas que la tienen registrada (sin contar las rechazadas).
  employeeCount: number;
}

export interface PositionSkillItem {
  skillId: string;
  name: string;
  category: 'TECHNICAL' | 'BEHAVIORAL';
  requiredLevel: number | null;
  isMandatory: boolean;
  weight: number;
}

/**
 * Catálogo de competencias de la organización y requisitos de cada cargo (position_skills).
 * Los requisitos se definen a mano por ahora; más adelante podrá proponerlos la IA desde los perfiles de cargo.
 */
@Injectable()
export class SkillsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currentOrganization: CurrentOrganizationService,
  ) {}

  // GET /api/skills: competencias activas, por nombre.
  async listSkills(): Promise<SkillItem[]> {
    const organization = await this.currentOrganization.getCurrentOrganization();
    const skills = await this.prisma.skill.findMany({
      where: { organizationId: organization.organizationId, archivedAt: null },
      orderBy: { name: 'asc' },
      include: { _count: { select: { employeeSkills: { where: { verificationStatus: { not: 'REJECTED' } } } } } },
    });
    return skills.map((skill) => ({
      id: skill.id,
      code: skill.code,
      name: skill.name,
      category: skill.category,
      employeeCount: skill._count.employeeSkills,
    }));
  }

  // GET /api/positions/:id/skills
  async getPositionSkills(positionId: string): Promise<PositionSkillItem[]> {
    const organization = await this.currentOrganization.getCurrentOrganization();
    await this.findActivePosition(organization.organizationId, positionId);
    return this.readPositionSkills(this.prisma, organization.organizationId, positionId);
  }

  // PUT /api/positions/:id/skills: reemplaza todos los requisitos del cargo en una transacción.
  async replacePositionSkills(positionId: string, requirements: RequirementInput[]): Promise<PositionSkillItem[]> {
    const organization = await this.currentOrganization.getCurrentOrganization();
    const organizationId = organization.organizationId;
    const position = await this.findActivePosition(organizationId, positionId);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const skills = await tx.skill.findMany({
          where: { organizationId },
          select: { id: true, name: true, code: true, archivedAt: true },
        });
        const activeIds = new Set(skills.filter((skill) => skill.archivedAt === null).map((skill) => skill.id));
        const catalog = new SkillCatalog(
          skills.filter((skill) => skill.archivedAt === null),
          skills.map((skill) => skill.code),
        );

        // 1. Resolver cada requisito a una competencia del catálogo (creándola si viene por nombre y no existe).
        const createdSkills: string[] = [];
        const rows: { skillId: string; requiredLevel: number | null; isMandatory: boolean; weight: number }[] = [];
        for (const requirement of requirements) {
          let skillId = requirement.skillId;
          if (skillId !== null) {
            if (!activeIds.has(skillId)) {
              throw new BadRequestException('Una de las competencias indicadas no existe o está archivada.');
            }
          } else {
            const { name, category } = requirement.newSkill!;
            skillId = catalog.find(name) ?? null;
            if (skillId === null) {
              const created = await tx.skill.create({
                data: { organizationId, code: catalog.newCode(name), name, category },
                select: { id: true },
              });
              skillId = created.id;
              catalog.remember(name, skillId);
              createdSkills.push(name);
            }
          }
          if (rows.some((row) => row.skillId === skillId)) {
            throw new BadRequestException('Una competencia aparece dos veces en los requisitos del cargo.');
          }
          rows.push({ skillId, requiredLevel: requirement.requiredLevel, isMandatory: requirement.isMandatory, weight: requirement.weight });
        }

        // 2. Reemplazar: se borran los requisitos que ya no vienen y se crean o actualizan los demás.
        const before = await this.readPositionSkills(tx, organizationId, positionId);
        await tx.positionSkill.deleteMany({
          where: { organizationId, positionId, skillId: { notIn: rows.map((row) => row.skillId) } },
        });
        for (const row of rows) {
          const data = { requiredLevel: row.requiredLevel, isMandatory: row.isMandatory, weight: new Prisma.Decimal(row.weight) };
          await tx.positionSkill.upsert({
            where: { organizationId_positionId_skillId: { organizationId, positionId, skillId: row.skillId } },
            create: { organizationId, positionId, skillId: row.skillId, ...data },
            update: data,
          });
        }

        const after = await this.readPositionSkills(tx, organizationId, positionId);
        await tx.auditEvent.create({
          data: {
            organizationId,
            actorMemberId: organization.memberId,
            action: 'POSITION_SKILLS_UPDATED',
            entityType: 'Position',
            entityId: positionId,
            changes: {
              position: position.title,
              before: before.map(summarize),
              after: after.map(summarize),
              createdSkills,
            } as unknown as Prisma.InputJsonObject,
          },
        });
        return after;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Otra persona guardó cambios al mismo tiempo. Recarga e intenta de nuevo.');
      }
      throw error;
    }
  }

  private async readPositionSkills(
    db: Prisma.TransactionClient | PrismaService,
    organizationId: string,
    positionId: string,
  ): Promise<PositionSkillItem[]> {
    const rows = await db.positionSkill.findMany({
      where: { organizationId, positionId },
      include: { skill: { select: { name: true, category: true } } },
    });
    return rows
      .map((row) => ({
        skillId: row.skillId,
        name: row.skill.name,
        category: row.skill.category,
        requiredLevel: row.requiredLevel,
        isMandatory: row.isMandatory,
        weight: Number(row.weight),
      }))
      .sort((a, b) => Number(b.isMandatory) - Number(a.isMandatory) || a.name.localeCompare(b.name, 'es'));
  }

  private async findActivePosition(organizationId: string, positionId: string) {
    const position = await this.prisma.position.findFirst({
      where: { id: positionId, organizationId, archivedAt: null },
      select: { id: true, title: true },
    });
    if (position === null) {
      throw new NotFoundException('El cargo no existe.');
    }
    return position;
  }
}

function summarize(item: PositionSkillItem) {
  return { name: item.name, requiredLevel: item.requiredLevel, isMandatory: item.isMandatory, weight: item.weight };
}
