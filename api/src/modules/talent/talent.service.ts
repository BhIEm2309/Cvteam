import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentOrganizationService } from '../../common/current-organization.service';
import { activeAssignmentWhere, todayAsDate } from '../../common/assignments';
import { TalentItem, TalentSkill } from './talent-item';
import { evaluateFit } from './fit-rules';

/**
 * Directorio de Talento: personas activas con su cargo vigente y sus competencias confirmadas.
 * Solo lee datos confirmados por personas (employee_skills); las propuestas de la IA pendientes no aparecen.
 */
@Injectable()
export class TalentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currentOrganization: CurrentOrganizationService,
  ) {}

  async listTalent(): Promise<TalentItem[]> {
    const organization = await this.currentOrganization.getCurrentOrganization();
    const organizationId = organization.organizationId;
    const today = todayAsDate();

    const employees = await this.prisma.employee.findMany({
      where: { organizationId, archivedAt: null },
      orderBy: { fullName: 'asc' },
      include: {
        // Cargo principal: el de mayor dedicación y, si empatan, el más antiguo.
        positionAssignments: {
          where: activeAssignmentWhere(today),
          orderBy: [{ allocationPercent: 'desc' }, { startDate: 'asc' }],
          take: 1,
          include: {
            position: {
              select: {
                id: true,
                title: true,
                department: { select: { name: true } },
                // Requisitos del cargo (position_skills), para calcular el ajuste.
                positionSkills: { include: { skill: { select: { name: true, archivedAt: true } } } },
              },
            },
          },
        },
        employeeSkills: {
          where: { verificationStatus: { not: 'REJECTED' }, skill: { archivedAt: null } },
          include: {
            skill: { select: { id: true, name: true, category: true } },
            evidence: { select: { excerpt: true } },
          },
        },
      },
    });

    return employees.map((employee) => {
      const position = employee.positionAssignments[0]?.position ?? null;
      const skills: TalentSkill[] = employee.employeeSkills
        .map((employeeSkill) => ({
          skillId: employeeSkill.skill.id,
          name: employeeSkill.skill.name,
          category: employeeSkill.skill.category,
          level: employeeSkill.level,
          verificationStatus: employeeSkill.verificationStatus,
          evidenceExcerpt: employeeSkill.evidence?.excerpt ?? null,
        }))
        // Primero las de mayor nivel; las sin nivel al final.
        .sort((a, b) => (b.level ?? 0) - (a.level ?? 0) || a.name.localeCompare(b.name, 'es'));

      // Ajuste al cargo con la regla explicable de fit-rules.ts (no se guarda; se calcula en cada consulta).
      const requirements = (position?.positionSkills ?? [])
        .filter((requirement) => requirement.skill.archivedAt === null)
        .map((requirement) => ({
          skillId: requirement.skillId,
          name: requirement.skill.name,
          requiredLevel: requirement.requiredLevel,
          isMandatory: requirement.isMandatory,
          weight: Number(requirement.weight),
        }))
        .sort((a, b) => Number(b.isMandatory) - Number(a.isMandatory) || a.name.localeCompare(b.name, 'es'));
      const fit = position === null
        ? { requirements: [], fitPercent: null, status: 'sin-requisitos' as const, reasons: ['No tiene un cargo vigente.'] }
        : evaluateFit(requirements, skills);

      return {
        id: employee.id,
        fullName: employee.fullName,
        area: position?.department.name ?? null,
        position: position ? { id: position.id, title: position.title } : null,
        skills,
        ...fit,
      };
    });
  }
}
