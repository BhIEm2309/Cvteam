import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentOrganizationService } from '../../common/current-organization.service';
import { SkillCatalog } from './skill-catalog';
import { RequirementInput } from './position-skills-input';
import { normalizeKey, OrgChartError, OrgChartFileError } from '../org-chart-import/org-chart-csv';
import { parsePositionProfileCsv } from './position-profile-csv';
import { PositionProfileImportResult, PositionProfileImportSummary } from './position-profile-import-result';

const CATEGORY_LABELS = { TECHNICAL: 'técnica', BEHAVIORAL: 'blanda' } as const;

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
 * Los requisitos se definen a mano (PUT) o desde un CSV de perfiles de cargo (importPositionProfiles); más adelante
 * podrá proponerlos la IA desde los perfiles de cargo.
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
      return await this.prisma.$transaction((tx) =>
        this.writeRequirements(tx, organizationId, organization.memberId, position, requirements, 'pantalla'),
      );
    } catch (error) {
      throw this.concurrentEditError(error);
    }
  }

  // POST /api/position-profiles/import?mode=preview|apply: requisitos de varios cargos desde un CSV.
  // "preview" valida y muestra qué cambiaría sin guardar; "apply" guarda todo en una transacción (o nada).
  async importPositionProfiles(file: Express.Multer.File | undefined, mode: 'preview' | 'apply'): Promise<PositionProfileImportResult> {
    if (!file) {
      throw new BadRequestException('Debes adjuntar el archivo CSV en el campo "file".');
    }
    let parsed: ReturnType<typeof parsePositionProfileCsv>;
    try {
      parsed = parsePositionProfileCsv(file.buffer);
    } catch (error) {
      if (error instanceof OrgChartFileError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
    const failed = (errors: OrgChartError[], warnings: OrgChartError[] = []): PositionProfileImportResult => ({
      mode,
      ok: false,
      saved: false,
      rowCount: parsed.rowCount,
      errors,
      warnings,
      summary: null,
    });
    if (!parsed.ok) {
      return failed(parsed.errors);
    }

    const organization = await this.currentOrganization.getCurrentOrganization();
    const organizationId = organization.organizationId;
    const [positions, skills] = await Promise.all([
      this.prisma.position.findMany({
        where: { organizationId, archivedAt: null },
        select: {
          id: true,
          title: true,
          department: { select: { name: true } },
          positionSkills: { select: { skill: { select: { name: true } } } },
        },
      }),
      this.prisma.skill.findMany({
        where: { organizationId, archivedAt: null },
        select: { id: true, name: true, category: true },
      }),
    ]);
    const positionsByKey = new Map(positions.map((p) => [`${normalizeKey(p.department.name)}|${normalizeKey(p.title)}`, p]));
    const skillsByKey = new Map(skills.map((skill) => [normalizeKey(skill.name), skill]));

    // Cruzar el archivo con la base: cargos que existen, competencias del catálogo y competencias nuevas.
    const errors: OrgChartError[] = [];
    const warnings: OrgChartError[] = [];
    const work: { position: { id: string; title: string }; requirements: RequirementInput[] }[] = [];
    const summary: PositionProfileImportSummary = { positions: [], createdSkills: [], positionsNotInFile: 0 };
    const newSkills = new Map<string, { name: string; category: 'TECHNICAL' | 'BEHAVIORAL'; line: number }>();

    for (const planned of parsed.plan.positions) {
      const position = positionsByKey.get(planned.key);
      if (!position) {
        errors.push({
          lines: planned.lines,
          message: `El cargo "${planned.title}" de "${planned.department}" no existe. Importa primero el organigrama o revisa el nombre del cargo y del área.`,
        });
        continue;
      }
      const requirements: RequirementInput[] = [];
      const after: PositionProfileImportSummary['positions'][number]['requirements'] = [];
      for (const row of planned.requirements) {
        const skillKey = normalizeKey(row.competencia);
        const existing = skillsByKey.get(skillKey);
        // Competencia nueva que ya apareció antes en el archivo: se crea una sola vez, con la primera escritura y categoría.
        const earlier = newSkills.get(skillKey);
        if (existing) {
          if (row.category !== null && row.category !== existing.category) {
            warnings.push({
              lines: [row.line],
              message: `"${existing.name}" ya existe en el catálogo como competencia ${CATEGORY_LABELS[existing.category]}: se mantiene así (el archivo dice ${CATEGORY_LABELS[row.category]}).`,
            });
          }
        } else if (earlier) {
          if (row.category !== null && row.category !== earlier.category) {
            warnings.push({
              lines: [row.line],
              message: `"${earlier.name}" se creará como competencia ${CATEGORY_LABELS[earlier.category]} (fila ${earlier.line}); esta fila dice ${CATEGORY_LABELS[row.category]}.`,
            });
          }
        } else if (row.category === null) {
          errors.push({
            lines: [row.line],
            message: `La competencia "${row.competencia}" no existe en el catálogo: indica su categoria (tecnica o blanda) para crearla.`,
          });
          continue;
        } else {
          newSkills.set(skillKey, { name: row.competencia, category: row.category, line: row.line });
          summary.createdSkills.push(row.competencia);
        }
        const created = existing ? null : (earlier ?? newSkills.get(skillKey)!);
        requirements.push({
          skillId: existing?.id ?? null,
          newSkill: created ? { name: created.name, category: created.category } : null,
          requiredLevel: row.requiredLevel,
          isMandatory: row.isMandatory,
          weight: row.weight,
        });
        after.push({
          name: existing?.name ?? created!.name,
          category: existing?.category ?? created!.category,
          requiredLevel: row.requiredLevel,
          isMandatory: row.isMandatory,
          weight: row.weight,
          isNewSkill: !existing,
        });
      }
      const afterKeys = new Set(after.map((item) => normalizeKey(item.name)));
      summary.positions.push({
        title: position.title,
        department: position.department.name,
        previousCount: position.positionSkills.length,
        requirements: after,
        // Orden alfabético: la base no garantiza el orden de las filas.
        removed: position.positionSkills
          .map((ps) => ps.skill.name)
          .filter((name) => !afterKeys.has(normalizeKey(name)))
          .sort((a, b) => a.localeCompare(b, 'es')),
      });
      work.push({ position: { id: position.id, title: position.title }, requirements });
    }
    summary.positionsNotInFile = positions.length - work.length;

    errors.sort((a, b) => (a.lines[0] ?? 0) - (b.lines[0] ?? 0));
    if (errors.length > 0) {
      return failed(errors, warnings);
    }
    if (mode === 'preview') {
      return { mode, ok: true, saved: false, rowCount: parsed.rowCount, errors: [], warnings, summary };
    }

    try {
      await this.prisma.$transaction(
        async (tx) => {
          for (const item of work) {
            await this.writeRequirements(tx, organizationId, organization.memberId, item.position, item.requirements, 'csv');
          }
          await tx.auditEvent.create({
            data: {
              organizationId,
              actorMemberId: organization.memberId,
              action: 'POSITION_PROFILES_IMPORTED',
              entityType: 'Organization',
              entityId: organizationId,
              changes: {
                fileName: file.originalname,
                rows: parsed.rowCount,
                positions: work.length,
                createdSkills: summary.createdSkills,
              },
            },
          });
        },
        { timeout: 60_000 },
      );
    } catch (error) {
      throw this.concurrentEditError(error);
    }
    return { mode, ok: true, saved: true, rowCount: parsed.rowCount, errors: [], warnings, summary };
  }

  // Reemplaza los requisitos de un cargo dentro de una transacción y lo registra en la auditoría.
  // Lo usan la edición en pantalla (PUT) y el CSV de perfiles, para que ambos apliquen las mismas reglas.
  private async writeRequirements(
    tx: Prisma.TransactionClient,
    organizationId: string,
    memberId: string,
    position: { id: string; title: string },
    requirements: RequirementInput[],
    source: 'pantalla' | 'csv',
  ): Promise<PositionSkillItem[]> {
    const positionId = position.id;
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
        actorMemberId: memberId,
        action: 'POSITION_SKILLS_UPDATED',
        entityType: 'Position',
        entityId: positionId,
        changes: {
          position: position.title,
          source,
          before: before.map(summarize),
          after: after.map(summarize),
          createdSkills,
        } as unknown as Prisma.InputJsonObject,
      },
    });
    return after;
  }

  private concurrentEditError(error: unknown): unknown {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return new ConflictException('Otra persona guardó cambios al mismo tiempo. Recarga e intenta de nuevo.');
    }
    return error;
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
