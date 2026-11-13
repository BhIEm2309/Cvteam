import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentOrganizationService } from '../../common/current-organization.service';
import { DocumentExtractionItem, ExtractionService } from './extraction.service';
import { SkillCatalog } from '../skills/skill-catalog';
import { finalSkillValues, ReviewInput } from './proposal-review';

// Resultado de guardar una revisión: qué cambió en la base.
export interface ReviewResult {
  employee: { id: string; fullName: string; created: boolean } | null;
  // Competencias nuevas en el catálogo de la organización.
  createdSkills: string[];
  // Competencias registradas a la persona (employee_skills nuevas).
  registered: string[];
  // Competencias que la persona ya tenía: no se modificaron.
  alreadyRegistered: string[];
  dismissed: number;
  extraction: DocumentExtractionItem;
}

// Se lanza dentro de la transacción para deshacer todo si otra persona revisó lo mismo al mismo tiempo.
class ReviewConflict extends ConflictException {}

/**
 * Revisión humana de las competencias que propuso la IA para un CV.
 * Confirmar crea skills (si no existe en el catálogo), evidence (el fragmento del CV) y employee_skills (DECLARED).
 * Nunca modifica una employee_skills que ya existía. Todo se guarda en una sola transacción.
 */
@Injectable()
export class ProposalReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currentOrganization: CurrentOrganizationService,
    private readonly extraction: ExtractionService,
  ) {}

  async reviewDocument(documentId: string, input: ReviewInput): Promise<ReviewResult> {
    const organization = await this.currentOrganization.getCurrentOrganization();
    const organizationId = organization.organizationId;
    const memberId = organization.memberId;
    const version = await this.extraction.findLatestVersion(organizationId, documentId);

    // Solo se revisa el último análisis exitoso de la última versión del CV.
    const run = await this.prisma.extractionRun.findFirst({
      where: { organizationId, documentVersionId: version.id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: { skillProposals: true },
    });
    if (run === null || run.status !== 'SUCCEEDED') {
      throw new ConflictException('Este CV no tiene un análisis terminado para revisar.');
    }

    const proposals = new Map(run.skillProposals.map((proposal) => [proposal.id, proposal]));
    for (const decision of input.decisions) {
      const proposal = proposals.get(decision.proposalId);
      if (proposal === undefined) {
        throw new BadRequestException(`La propuesta ${decision.proposalId} no pertenece al análisis de este CV.`);
      }
      if (proposal.reviewStatus !== 'PENDING') {
        throw new ConflictException(`La competencia "${proposal.name}" ya fue revisada. Recarga la página.`);
      }
    }

    const confirms = input.decisions.filter((decision) => decision.action === 'confirm');
    const currentEmployee = version.document.employee;

    // Persona existente: debe estar activa. El CV no puede quedar vinculado a dos personas.
    if (confirms.length > 0 && input.employeeId !== null) {
      const employee = await this.prisma.employee.findFirst({
        where: { id: input.employeeId, organizationId, archivedAt: null },
        select: { id: true },
      });
      if (employee === null) {
        throw new NotFoundException('La persona elegida no existe o está archivada.');
      }
    }
    if (confirms.length > 0 && currentEmployee !== null && input.employeeId !== currentEmployee.id) {
      throw new ConflictException(`Este CV ya está vinculado a ${currentEmployee.fullName}.`);
    }

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const now = new Date();
        let employee: ReviewResult['employee'] = null;

        if (confirms.length > 0) {
          employee = await this.resolveEmployee(tx, organizationId, memberId, input);
          // Vincula el CV a la persona (solo si todavía no estaba vinculado; arriba se revisó que no sea otra).
          await tx.document.updateMany({
            where: { id: documentId, organizationId, employeeId: null },
            data: { employeeId: employee.id },
          });
        }

        const skills = await tx.skill.findMany({
          where: { organizationId },
          select: { id: true, name: true, code: true, archivedAt: true },
        });
        const catalog = new SkillCatalog(
          skills.filter((skill) => skill.archivedAt === null),
          skills.map((skill) => skill.code),
        );

        const createdSkills: string[] = [];
        const registered: string[] = [];
        const alreadyRegistered: string[] = [];
        let dismissed = 0;

        for (const decision of input.decisions) {
          const proposal = proposals.get(decision.proposalId)!;

          if (decision.action === 'dismiss') {
            await this.markReviewed(tx, organizationId, proposal.id, { reviewStatus: 'DISMISSED', reviewedByMemberId: memberId, reviewedAt: now });
            dismissed++;
            continue;
          }

          const values = finalSkillValues(proposal, decision);
          const employeeId = employee!.id;

          // 1. Competencia del catálogo: la existente con el mismo nombre o una nueva.
          let skillId = catalog.find(values.name);
          if (skillId === undefined) {
            const created = await tx.skill.create({
              data: { organizationId, code: catalog.newCode(values.name), name: values.name, category: values.category },
              select: { id: true },
            });
            skillId = created.id;
            catalog.remember(values.name, skillId);
            createdSkills.push(values.name);
          }

          // 2. Si la persona ya tenía esa competencia, no se toca (puede estar verificada o corregida a mano).
          const existing = await tx.employeeSkill.findFirst({
            where: { organizationId, employeeId, skillId },
            select: { id: true },
          });
          if (existing !== null) {
            alreadyRegistered.push(values.name);
          } else {
            // 3. Evidencia: el fragmento del CV, la versión exacta y el análisis que lo propuso (no se edita nunca).
            const evidence = await tx.evidence.create({
              data: {
                organizationId,
                kind: 'DOCUMENT',
                documentVersionId: version.id,
                extractionRunId: run.id,
                excerpt: proposal.excerpt,
                recordedByMemberId: memberId,
              },
              select: { id: true },
            });
            // DECLARED: lo dice el CV. VERIFIED queda para una verificación posterior.
            await tx.employeeSkill.create({
              data: { organizationId, employeeId, skillId, level: values.level, verificationStatus: 'DECLARED', evidenceId: evidence.id },
            });
            registered.push(values.name);
          }

          await this.markReviewed(tx, organizationId, proposal.id, {
            reviewStatus: 'CONFIRMED',
            employeeId,
            skillId,
            reviewedByMemberId: memberId,
            reviewedAt: now,
          });
        }

        await tx.auditEvent.create({
          data: {
            organizationId,
            actorMemberId: memberId,
            action: 'EXTRACTION_REVIEWED',
            entityType: 'ExtractionRun',
            entityId: run.id,
            changes: {
              documentId,
              employeeId: employee?.id ?? null,
              confirmed: confirms.length,
              dismissed,
              createdSkills,
              registered,
              alreadyRegistered,
            },
          },
        });

        return { employee, createdSkills, registered, alreadyRegistered, dismissed };
      });

      return { ...result, extraction: await this.extraction.getDocumentExtraction(documentId) };
    } catch (error) {
      // Dos revisiones al mismo tiempo pueden crear la misma competencia (código repetido).
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Otra persona guardó cambios al mismo tiempo. Recarga la página e intenta de nuevo.');
      }
      throw error;
    }
  }

  // La persona elegida, o una nueva creada con el nombre indicado (sin cargo).
  private async resolveEmployee(
    tx: Prisma.TransactionClient,
    organizationId: string,
    memberId: string,
    input: ReviewInput,
  ): Promise<{ id: string; fullName: string; created: boolean }> {
    if (input.employeeId !== null) {
      const employee = await tx.employee.findFirstOrThrow({
        where: { id: input.employeeId, organizationId },
        select: { id: true, fullName: true },
      });
      return { ...employee, created: false };
    }

    const created = await tx.employee.create({
      data: { organizationId, fullName: input.newEmployeeName! },
      select: { id: true, fullName: true },
    });
    await tx.auditEvent.create({
      data: {
        organizationId,
        actorMemberId: memberId,
        action: 'EMPLOYEE_CREATED',
        entityType: 'Employee',
        entityId: created.id,
        changes: { fullName: created.fullName, source: 'revision-de-cv' },
      },
    });
    return { ...created, created: true };
  }

  // Marca una propuesta como revisada solo si sigue pendiente. Si otra persona la revisó antes, se deshace todo.
  private async markReviewed(
    tx: Prisma.TransactionClient,
    organizationId: string,
    proposalId: string,
    data: Prisma.SkillProposalUncheckedUpdateManyInput,
  ): Promise<void> {
    const updated = await tx.skillProposal.updateMany({
      where: { id: proposalId, organizationId, reviewStatus: 'PENDING' },
      data,
    });
    if (updated.count !== 1) {
      throw new ReviewConflict('Otra persona revisó estas competencias al mismo tiempo. Recarga la página.');
    }
  }
}
