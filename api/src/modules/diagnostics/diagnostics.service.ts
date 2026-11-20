import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentOrganizationService } from '../../common/current-organization.service';
import { activeAssignmentWhere, todayAsDate } from '../../common/assignments';
import { readOptionalText, toObject } from '../../common/input';
import { FIT_RULES } from '../talent/fit-rules';
import {
  DIAGNOSTIC_RULES,
  DiagnosticInput,
  DiagnosticSummary,
  INPUT_SCHEMA_VERSION,
  RULESET_VERSION,
  runDiagnostic,
} from './diagnostic-rules';
import { DiagnosticRunItem, FindingItem, RecommendationItem, RunDiagnosticResponse } from './diagnostic-run-item';

const SEVERITY_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 } as const;
const MAX_TITLE = 200;
const MAX_NOTES = 2000;

/**
 * Diagnóstico organizacional con reglas explicables (diagnostic-rules.ts), sin IA.
 *
 * - POST /api/diagnostics toma una foto de los datos confirmados, aplica las reglas y guarda el resultado
 *   (diagnostic_runs, findings, finding_evidence, recommendations). Si los datos no cambiaron desde el último
 *   diagnóstico, devuelve ese mismo: la clave de idempotencia es la versión de las reglas + el hash de la foto.
 * - Nada de esto modifica cargos, personas ni competencias: los resultados son propuestas para que una persona decida.
 */
@Injectable()
export class DiagnosticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currentOrganization: CurrentOrganizationService,
  ) {}

  async runDiagnostic(): Promise<RunDiagnosticResponse> {
    const organization = await this.currentOrganization.getCurrentOrganization();
    const organizationId = organization.organizationId;
    const today = todayAsDate();
    const input = await this.loadInput(organizationId, today);
    const inputHash = hashInput(input);
    const idempotencyKey = `${RULESET_VERSION}:${inputHash}`;

    const existing = await this.prisma.diagnosticRun.findUnique({
      where: { organizationId_idempotencyKey: { organizationId, idempotencyKey } },
      select: { id: true },
    });
    if (existing) {
      return { created: false, run: await this.readRun(organizationId, existing.id, inputHash) };
    }

    const result = runDiagnostic(input);
    const startedAt = new Date();
    let runId: string;
    try {
      runId = await this.prisma.$transaction(
        async (tx) => {
          const run = await tx.diagnosticRun.create({
            data: {
              organizationId,
              status: 'SUCCEEDED',
              asOfDate: today,
              requestedByMemberId: organization.memberId,
              idempotencyKey,
              rulesetVersion: RULESET_VERSION,
              inputSchemaVersion: INPUT_SCHEMA_VERSION,
              configuration: { fitRules: FIT_RULES, diagnosticRules: DIAGNOSTIC_RULES } as unknown as Prisma.InputJsonObject,
              inputSnapshot: input as unknown as Prisma.InputJsonObject,
              inputHash,
              summary: result.summary as unknown as Prisma.InputJsonObject,
              attemptCount: 1,
              startedAt,
              finishedAt: new Date(),
            },
            select: { id: true },
          });

          for (const draft of result.findings) {
            const finding = await tx.finding.create({
              data: {
                organizationId,
                diagnosticRunId: run.id,
                ruleCode: draft.ruleCode,
                fingerprint: draft.fingerprint,
                type: draft.type,
                severity: draft.severity,
                title: draft.title.slice(0, MAX_TITLE),
                description: draft.description,
                departmentId: draft.departmentId,
                positionId: draft.positionId,
                employeeId: draft.employeeId,
                metrics: draft.metrics as Prisma.InputJsonObject,
              },
              select: { id: true },
            });
            if (draft.evidenceIds.length > 0) {
              await tx.findingEvidence.createMany({
                data: draft.evidenceIds.map((evidenceId) => ({ organizationId, findingId: finding.id, evidenceId })),
              });
            }
            if (draft.recommendations.length > 0) {
              await tx.recommendation.createMany({
                data: draft.recommendations.map((recommendation) => ({
                  organizationId,
                  findingId: finding.id,
                  title: recommendation.title.slice(0, MAX_TITLE),
                  description: recommendation.description,
                  origin: 'RULE' as const,
                  generationMetadata: recommendation.metadata as Prisma.InputJsonObject,
                  priority: recommendation.priority,
                })),
              });
            }
          }

          await tx.auditEvent.create({
            data: {
              organizationId,
              actorMemberId: organization.memberId,
              action: 'DIAGNOSTIC_RUN_CREATED',
              entityType: 'DiagnosticRun',
              entityId: run.id,
              changes: { rulesetVersion: RULESET_VERSION, findings: result.findings.length, summary: result.summary } as unknown as Prisma.InputJsonObject,
            },
          });
          return run.id;
        },
        { timeout: 60_000 },
      );
    } catch (error) {
      // Dos personas ejecutaron el mismo diagnóstico a la vez: se devuelve el que quedó guardado.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const saved = await this.prisma.diagnosticRun.findUnique({
          where: { organizationId_idempotencyKey: { organizationId, idempotencyKey } },
          select: { id: true },
        });
        if (saved) return { created: false, run: await this.readRun(organizationId, saved.id, inputHash) };
      }
      throw error;
    }

    return { created: true, run: await this.readRun(organizationId, runId, inputHash) };
  }

  // GET /api/diagnostics/latest: el diagnóstico de los datos actuales si existe; si no, el último guardado (marcado
  // como desactualizado). null si nunca se ejecutó. Así, si los datos vuelven a quedar como estaban (A → B → A), se
  // muestra el diagnóstico que corresponde a A y no el de B.
  async getLatest(): Promise<{ run: DiagnosticRunItem | null }> {
    const organization = await this.currentOrganization.getCurrentOrganization();
    const organizationId = organization.organizationId;
    const currentHash = hashInput(await this.loadInput(organizationId, todayAsDate()));
    const current = await this.prisma.diagnosticRun.findUnique({
      where: { organizationId_idempotencyKey: { organizationId, idempotencyKey: `${RULESET_VERSION}:${currentHash}` } },
      select: { id: true },
    });
    const latest =
      current ??
      (await this.prisma.diagnosticRun.findFirst({
        where: { organizationId, status: 'SUCCEEDED' },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { id: true },
      }));
    if (!latest) return { run: null };
    return { run: await this.readRun(organizationId, latest.id, currentHash) };
  }

  // PATCH /api/diagnostics/recommendations/:id { status: "ACCEPTED" | "REJECTED", notes? }
  // Registra la decisión de una persona. NO cambia el organigrama ni asigna cargos: eso se hace aparte.
  async decideRecommendation(recommendationId: string, body: unknown): Promise<RecommendationItem> {
    const data = toObject(body);
    if (data.status !== 'ACCEPTED' && data.status !== 'REJECTED') {
      throw new BadRequestException('El campo "status" debe ser ACCEPTED (aceptar) o REJECTED (rechazar).');
    }
    const notes = readOptionalText(data.notes, 'notes', MAX_NOTES) ?? null;

    const organization = await this.currentOrganization.getCurrentOrganization();
    const organizationId = organization.organizationId;
    const recommendation = await this.prisma.recommendation.findFirst({
      where: { id: recommendationId, organizationId },
      select: { id: true, status: true, title: true },
    });
    if (!recommendation) {
      throw new NotFoundException('La recomendación no existe.');
    }

    return this.prisma.$transaction(async (tx) => {
      // Solo se decide una vez: si otra persona ya decidió, no se pisa su decisión.
      const updated = await tx.recommendation.updateMany({
        where: { id: recommendationId, organizationId, status: 'PROPOSED' },
        data: { status: data.status as 'ACCEPTED' | 'REJECTED', decidedByMemberId: organization.memberId, decidedAt: new Date(), decisionNotes: notes },
      });
      if (updated.count === 0) {
        throw new ConflictException('Esta recomendación ya tiene una decisión. Recarga la página.');
      }
      await tx.auditEvent.create({
        data: {
          organizationId,
          actorMemberId: organization.memberId,
          action: data.status === 'ACCEPTED' ? 'RECOMMENDATION_ACCEPTED' : 'RECOMMENDATION_REJECTED',
          entityType: 'Recommendation',
          entityId: recommendationId,
          changes: { title: recommendation.title, notes },
        },
      });
      const row = await tx.recommendation.findUniqueOrThrow({ where: { id: recommendationId } });
      return toRecommendationItem(row);
    });
  }

  // ---------- Foto de la organización ----------

  // Solo datos confirmados y vigentes hoy, ordenados de forma estable (el hash no debe depender del orden de la base).
  private async loadInput(organizationId: string, today: Date): Promise<DiagnosticInput> {
    const [positions, employees] = await Promise.all([
      this.prisma.position.findMany({
        where: { organizationId, archivedAt: null },
        select: {
          id: true,
          title: true,
          departmentId: true,
          parentPositionId: true,
          targetHeadcount: true,
          department: { select: { name: true } },
          positionSkills: {
            where: { skill: { archivedAt: null } },
            select: { skillId: true, requiredLevel: true, isMandatory: true, weight: true, skill: { select: { name: true } } },
          },
        },
      }),
      this.prisma.employee.findMany({
        where: { organizationId, archivedAt: null },
        select: {
          id: true,
          fullName: true,
          positionAssignments: {
            where: activeAssignmentWhere(today),
            orderBy: [{ allocationPercent: 'desc' }, { startDate: 'asc' }, { positionId: 'asc' }],
            select: { positionId: true },
          },
          employeeSkills: {
            where: { verificationStatus: { not: 'REJECTED' }, skill: { archivedAt: null } },
            select: { skillId: true, level: true, evidenceId: true, skill: { select: { name: true } } },
          },
        },
      }),
    ]);

    const activePositionIds = new Set(positions.map((position) => position.id));
    const byId = <T extends { id: string }>(a: T, b: T) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    const bySkill = <T extends { skillId: string }>(a: T, b: T) => (a.skillId < b.skillId ? -1 : a.skillId > b.skillId ? 1 : 0);

    return {
      positions: positions
        .map((position) => ({
          id: position.id,
          title: position.title,
          departmentId: position.departmentId,
          departmentName: position.department.name,
          parentPositionId: position.parentPositionId,
          targetHeadcount: position.targetHeadcount,
          requirements: position.positionSkills
            .map((requirement) => ({
              skillId: requirement.skillId,
              name: requirement.skill.name,
              requiredLevel: requirement.requiredLevel,
              isMandatory: requirement.isMandatory,
              weight: Number(requirement.weight),
            }))
            .sort(bySkill),
        }))
        .sort(byId),
      employees: employees
        .map((employee) => ({
          id: employee.id,
          fullName: employee.fullName,
          positionIds: [...new Set(employee.positionAssignments.map((a) => a.positionId))].filter((id) => activePositionIds.has(id)),
          skills: employee.employeeSkills
            .map((skill) => ({ skillId: skill.skillId, name: skill.skill.name, level: skill.level, evidenceId: skill.evidenceId }))
            .sort(bySkill),
        }))
        .sort(byId),
    };
  }

  // ---------- Lectura de un diagnóstico guardado ----------

  private async readRun(organizationId: string, runId: string, currentHash: string): Promise<DiagnosticRunItem> {
    const run = await this.prisma.diagnosticRun.findFirst({
      where: { id: runId, organizationId },
      include: {
        findings: {
          include: {
            findingEvidence: { include: { evidence: { select: { id: true, excerpt: true } } } },
            recommendations: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
          },
        },
      },
    });
    if (!run) {
      throw new NotFoundException('El diagnóstico no existe.');
    }

    const findings: FindingItem[] = run.findings
      .map((finding) => ({
        id: finding.id,
        ruleCode: finding.ruleCode,
        type: finding.type as FindingItem['type'],
        severity: finding.severity,
        title: finding.title,
        description: finding.description,
        positionId: finding.positionId,
        employeeId: finding.employeeId,
        metrics: (finding.metrics ?? {}) as Record<string, unknown>,
        evidence: finding.findingEvidence.map((link) => ({ id: link.evidence.id, excerpt: link.evidence.excerpt })),
        recommendations: finding.recommendations.map(toRecommendationItem),
      }))
      .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.title.localeCompare(b.title, 'es'));

    return {
      id: run.id,
      createdAt: run.createdAt,
      asOfDate: run.asOfDate.toISOString().slice(0, 10),
      rulesetVersion: run.rulesetVersion,
      isOutdated: run.inputHash !== currentHash,
      summary: run.summary as unknown as DiagnosticSummary,
      findings,
    };
  }
}

function toRecommendationItem(row: {
  id: string;
  title: string;
  description: string;
  priority: RecommendationItem['priority'];
  status: RecommendationItem['status'];
  generationMetadata: Prisma.JsonValue;
  decidedAt: Date | null;
  decisionNotes: string | null;
}): RecommendationItem {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    priority: row.priority,
    status: row.status,
    metadata: (row.generationMetadata ?? {}) as Record<string, unknown>,
    decidedAt: row.decidedAt,
    decisionNotes: row.decisionNotes,
  };
}

// Hash de la foto: si nada cambió, el diagnóstico sería el mismo.
function hashInput(input: DiagnosticInput): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}
