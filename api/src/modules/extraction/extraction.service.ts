import { BadRequestException, ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FileStorageService } from '../../storage/file-storage.service';
import { CurrentOrganizationService } from '../../common/current-organization.service';
import { OUTPUT_SCHEMA_VERSION } from './cv-extraction-schema';
import { EXTRACTION_PROVIDER, ExtractionFailure, ExtractionProvider } from './extraction-provider';
import { AnalysisStatus, queueExtraction, toAnalysisStatus } from './extraction-queue';
import { extractPdfText } from './pdf-text';
import { buildProposals, DiscardedSkill } from './proposals';
import { suggestEmployee } from './proposal-review';

// Intentos máximos de una ejecución interrumpida (por ejemplo, si la API se reinició a mitad del análisis).
const MAX_ATTEMPTS = 3;
// Una ejecución "Procesando" por más de este tiempo se considera interrumpida.
const STALE_RUNNING_MINUTES = 15;

export interface SkillProposalItem {
  id: string;
  name: string;
  category: 'TECHNICAL' | 'BEHAVIORAL';
  level: number | null;
  excerpt: string;
  reviewStatus: 'PENDING' | 'CONFIRMED' | 'DISMISSED';
}

export interface DocumentExtractionItem {
  documentId: string;
  documentVersionId: string;
  documentTitle: string;
  documentType: 'CV' | 'JOB_PROFILE' | 'SUPPORTING';
  // Persona a la que ya está vinculado el CV (se fija al confirmar la primera revisión).
  employee: { id: string; fullName: string } | null;
  // Persona sugerida: la única persona activa con el mismo nombre que detectó la IA.
  suggestedEmployeeId: string | null;
  status: AnalysisStatus;
  run: {
    id: string;
    provider: string | null;
    // Modelo que respondió (o el configurado, si el análisis falló antes de recibir respuesta).
    model: string | null;
    // Modelo que se pidió. Si es distinto de model, actuó el respaldo automático de la API.
    requestedModel: string | null;
    attemptCount: number;
    errorCode: string | null;
    errorMessage: string | null;
    createdAt: Date;
    startedAt: Date | null;
    finishedAt: Date | null;
    candidateName: string | null;
    discarded: DiscardedSkill[];
  } | null;
  proposals: SkillProposalItem[];
}

// Lo que se guarda en extraction_runs.structured_output (resultado ya validado y filtrado).
interface StoredOutput {
  schemaVersion: string;
  // Modelo configurado al momento del análisis (extraction_runs.model guarda el que respondió).
  requestedModel: string | null;
  candidateName: string | null;
  discarded: DiscardedSkill[];
}

@Injectable()
export class ExtractionService {
  private readonly logger = new Logger(ExtractionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fileStorage: FileStorageService,
    private readonly currentOrganization: CurrentOrganizationService,
    @Inject(EXTRACTION_PROVIDER) private readonly provider: ExtractionProvider,
  ) {}

  // ---------- Usadas por el controlador (organización actual) ----------

  // Estado del análisis de la última versión de un documento y sus competencias propuestas.
  async getDocumentExtraction(documentId: string): Promise<DocumentExtractionItem> {
    const organization = await this.currentOrganization.getCurrentOrganization();
    const version = await this.findLatestVersion(organization.organizationId, documentId);

    const run = await this.prisma.extractionRun.findFirst({
      where: { organizationId: organization.organizationId, documentVersionId: version.id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: { skillProposals: { orderBy: [{ category: 'asc' }, { name: 'asc' }] } },
    });

    const documentInfo = {
      documentId,
      documentVersionId: version.id,
      documentTitle: version.document.title,
      documentType: version.document.type,
      employee: version.document.employee
        ? { id: version.document.employee.id, fullName: version.document.employee.fullName }
        : null,
    };

    if (run === null) {
      return { ...documentInfo, suggestedEmployeeId: null, status: 'PENDING_ANALYSIS', run: null, proposals: [] };
    }

    const output = readStoredOutput(run.structuredOutput);
    const candidateName = output?.candidateName ?? null;
    const activeEmployees =
      candidateName === null
        ? []
        : await this.prisma.employee.findMany({
            where: { organizationId: organization.organizationId, archivedAt: null },
            select: { id: true, fullName: true },
          });

    return {
      ...documentInfo,
      suggestedEmployeeId: suggestEmployee(candidateName, activeEmployees),
      status: toAnalysisStatus(run.status),
      run: {
        id: run.id,
        provider: run.provider,
        model: run.model,
        requestedModel: output?.requestedModel ?? run.model,
        attemptCount: run.attemptCount,
        errorCode: run.errorCode,
        errorMessage: run.errorMessage,
        createdAt: run.createdAt,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        candidateName: output?.candidateName ?? null,
        discarded: output?.discarded ?? [],
      },
      proposals: run.skillProposals.map((proposal) => ({
        id: proposal.id,
        name: proposal.name,
        category: proposal.category,
        level: proposal.level,
        excerpt: proposal.excerpt,
        reviewStatus: proposal.reviewStatus,
      })),
    };
  }

  // Pide analizar (de nuevo) un CV. Solo si nunca se analizó o si el último análisis falló.
  async requestExtraction(documentId: string): Promise<DocumentExtractionItem> {
    const organization = await this.currentOrganization.getCurrentOrganization();
    const version = await this.findLatestVersion(organization.organizationId, documentId);

    if (version.document.type !== 'CV') {
      throw new BadRequestException('Por ahora solo se analizan CVs. Los perfiles de cargo llegarán en un paso siguiente.');
    }

    const latestRun = await this.prisma.extractionRun.findFirst({
      where: { organizationId: organization.organizationId, documentVersionId: version.id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { status: true },
    });
    if (latestRun?.status === 'QUEUED' || latestRun?.status === 'RUNNING') {
      throw new ConflictException('El CV ya está en análisis.');
    }
    if (latestRun?.status === 'SUCCEEDED') {
      throw new ConflictException('El CV ya fue analizado. Revisa sus competencias propuestas.');
    }

    await this.prisma.$transaction(async (tx) => {
      const run = await queueExtraction(tx, organization.organizationId, version.id);
      await tx.auditEvent.create({
        data: {
          organizationId: organization.organizationId,
          actorMemberId: organization.memberId,
          action: 'EXTRACTION_REQUESTED',
          entityType: 'ExtractionRun',
          entityId: run.id,
          changes: { documentId, documentVersionId: version.id },
        },
      });
    });

    return this.getDocumentExtraction(documentId);
  }

  // ---------- Usadas por el proceso en segundo plano (ExtractionWorker) ----------
  // Este proceso no atiende a una persona: trabaja con la organización guardada en cada ejecución
  // (extraction_runs.organization_id) y filtra todas sus consultas por ella.

  // Devuelve a la cola las ejecuciones interrumpidas; las que ya agotaron sus intentos quedan en error.
  async recoverInterruptedRuns(): Promise<void> {
    const requeued = await this.prisma.$executeRaw`
      UPDATE extraction_runs SET status = 'QUEUED', started_at = NULL
      WHERE status = 'RUNNING' AND attempt_count < ${MAX_ATTEMPTS}::int
        AND started_at < now() - (${STALE_RUNNING_MINUTES}::int * interval '1 minute')`;
    const failed = await this.prisma.$executeRaw`
      UPDATE extraction_runs SET status = 'FAILED', finished_at = now(), error_code = 'INTERRUMPIDO',
        error_message = 'El análisis se interrumpió varias veces. Pide analizar el CV de nuevo.'
      WHERE status = 'RUNNING' AND attempt_count >= ${MAX_ATTEMPTS}::int
        AND started_at < now() - (${STALE_RUNNING_MINUTES}::int * interval '1 minute')`;
    if (requeued + failed > 0) {
      this.logger.warn(`Análisis interrumpidos: ${requeued} vuelven a la cola, ${failed} quedan en error.`);
    }
  }

  /**
   * Toma la ejecución más antigua en cola y la procesa. Devuelve false si no había nada en cola.
   * FOR UPDATE SKIP LOCKED: si hubiera dos procesos, cada uno toma una ejecución distinta.
   */
  async processNextRun(): Promise<boolean> {
    const claimed = await this.prisma.$queryRaw<{ id: string; organizationId: string }[]>`
      UPDATE extraction_runs
      SET status = 'RUNNING', started_at = now(), attempt_count = attempt_count + 1
      WHERE id = (
        SELECT id FROM extraction_runs WHERE status = 'QUEUED'
        ORDER BY created_at, id LIMIT 1 FOR UPDATE SKIP LOCKED
      )
      RETURNING id, organization_id AS "organizationId"`;

    const next = claimed[0];
    if (next === undefined) {
      return false;
    }
    await this.processRun(next.organizationId, next.id);
    return true;
  }

  private async processRun(organizationId: string, runId: string): Promise<void> {
    const run = await this.prisma.extractionRun.findFirst({
      where: { id: runId, organizationId },
      include: { documentVersion: { select: { storageKey: true, documentId: true } } },
    });
    if (run === null) {
      return;
    }

    const providerInfo = {
      provider: this.provider.providerName,
      model: this.provider.model,
      promptVersion: this.provider.promptVersion,
    };
    let cvText: string | null = null;

    try {
      const pdf = await this.readStoredFile(run.documentVersion.storageKey);
      cvText = await extractPdfText(pdf);
      const { extraction, respondedModel } = await this.provider.extractCvSkills(cvText);
      const result = buildProposals(extraction, cvText);
      const output: StoredOutput = {
        schemaVersion: OUTPUT_SCHEMA_VERSION,
        requestedModel: providerInfo.model,
        candidateName: result.candidateName,
        discarded: result.discarded,
      };

      await this.prisma.$transaction(async (tx) => {
        await tx.extractionRun.update({
          where: { id: run.id },
          data: {
            ...providerInfo,
            // Se guarda el modelo que realmente respondió, no el configurado.
            model: respondedModel,
            status: 'SUCCEEDED',
            extractedText: cvText,
            structuredOutput: output as unknown as Prisma.InputJsonObject,
            errorCode: null,
            errorMessage: null,
            finishedAt: new Date(),
          },
        });

        // Las competencias quedan como PROPUESTAS (PENDING): no se crean skills ni employee_skills.
        if (result.proposals.length > 0) {
          await tx.skillProposal.createMany({
            data: result.proposals.map((proposal) => ({
              organizationId,
              extractionRunId: run.id,
              name: proposal.name,
              category: proposal.category,
              level: proposal.level,
              excerpt: proposal.excerpt,
            })),
          });
        }

        await tx.auditEvent.create({
          data: {
            organizationId,
            actorMemberId: null, // proceso del sistema
            action: 'EXTRACTION_SUCCEEDED',
            entityType: 'ExtractionRun',
            entityId: run.id,
            changes: {
              documentId: run.documentVersion.documentId,
              proposals: result.proposals.length,
              discarded: result.discarded.length,
              requestedModel: providerInfo.model,
              model: respondedModel,
            },
          },
        });
      });
    } catch (error) {
      const failure = error instanceof ExtractionFailure ? error : null;
      if (failure === null) {
        // Error inesperado: el detalle queda solo en el registro del servidor, no en la base ni en la pantalla.
        this.logger.error(`Error inesperado al analizar la ejecución ${run.id}`, error instanceof Error ? error.stack : String(error));
      }

      await this.prisma.extractionRun.update({
        where: { id: run.id },
        data: {
          ...providerInfo,
          status: 'FAILED',
          extractedText: cvText,
          errorCode: failure?.code ?? 'ERROR_INTERNO',
          errorMessage: failure?.message ?? 'Error inesperado al analizar el CV. Revisa el registro de la API.',
          finishedAt: new Date(),
        },
      });
    }
  }

  // ---------- Funciones de apoyo ----------

  private async readStoredFile(storageKey: string): Promise<Buffer> {
    try {
      return await this.fileStorage.readFile(storageKey);
    } catch {
      throw new ExtractionFailure('ARCHIVO_NO_ENCONTRADO', 'El archivo del CV no se encuentra en el almacenamiento.');
    }
  }

  // Última versión guardada de un documento activo de la organización (la usa también la revisión).
  async findLatestVersion(organizationId: string, documentId: string) {
    const version = await this.prisma.documentVersion.findFirst({
      where: {
        organizationId,
        documentId,
        uploadStatus: 'STORED',
        document: { archivedAt: null },
      },
      orderBy: { versionNumber: 'desc' },
      include: {
        document: {
          select: { type: true, title: true, employee: { select: { id: true, fullName: true } } },
        },
      },
    });
    if (version === null) {
      throw new NotFoundException('El documento no existe.');
    }
    return version;
  }
}

// structured_output es JSON libre en la base: se lee con cuidado.
function readStoredOutput(value: Prisma.JsonValue | null): StoredOutput | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const discarded = Array.isArray(record.discarded)
    ? record.discarded.filter(
        (item): item is DiscardedSkill =>
          typeof item === 'object' && item !== null && typeof (item as DiscardedSkill).name === 'string' && typeof (item as DiscardedSkill).reason === 'string',
      )
    : [];
  return {
    schemaVersion: typeof record.schemaVersion === 'string' ? record.schemaVersion : '',
    requestedModel: typeof record.requestedModel === 'string' ? record.requestedModel : null,
    candidateName: typeof record.candidateName === 'string' ? record.candidateName : null,
    discarded,
  };
}
