import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentOrganizationService } from '../../common/current-organization.service';
import { activeAssignmentWhere, todayAsDate } from '../../common/assignments';
import { setCurrentPosition } from '../employees/employee-assignment';
import { generateCode, normalizeKey, OrgChartError, OrgChartFileError, OrgChartPlan, parseOrgChartCsv } from './org-chart-csv';
import { OrgChartImportResult, OrgChartImportSummary } from './org-chart-import-result';

// Datos actuales de la organización que se comparan con el archivo.
interface ExistingData {
  departments: { id: string; name: string }[];
  departmentCodes: Set<string>;
  positions: { id: string; title: string; departmentName: string; parentPositionId: string | null }[];
  positionCodes: Set<string>;
  employees: { id: string; fullName: string; employeeCode: string | null; positionIds: string[] }[];
  // Códigos de personas archivadas: la base no deja reutilizarlos.
  archivedEmployeeCodes: Set<string>;
}

// Qué hacer con cada elemento del archivo. "existing" = ya está en la base; "create" = hay que crearlo.
type DepartmentAction = { kind: 'existing'; id: string; name: string } | { kind: 'create'; name: string; code: string };
type PositionAction =
  | { kind: 'existing'; id: string; title: string; departmentKey: string; currentParentId: string | null }
  | { kind: 'create'; title: string; departmentKey: string; code: string };
type EmployeeAction =
  | { kind: 'existing'; id: string; fullName: string; positionKey: string; currentPositionIds: string[]; setCode: string | null }
  | { kind: 'create'; fullName: string; code: string | null; positionKey: string };

interface ChangeSet {
  departments: Map<string, DepartmentAction>;
  positions: Map<string, PositionAction>;
  employees: EmployeeAction[];
}

const positionKeyOf = (departmentName: string, title: string) => `${normalizeKey(departmentName)}|${normalizeKey(title)}`;

/**
 * Importa un organigrama desde CSV (nombre, cargo, área, jefe directo).
 *
 * - "preview": valida el archivo y lo compara con la base, sin guardar nada.
 * - "apply": hace lo mismo y guarda todo en una sola transacción (todo o nada).
 *
 * Las personas que no vienen en el archivo NO se archivan: solo se informan.
 * Las asignaciones nuevas empiezan hoy (el CSV no trae fechas).
 */
@Injectable()
export class OrgChartImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currentOrganization: CurrentOrganizationService,
  ) {}

  async importOrgChart(file: Express.Multer.File | undefined, mode: 'preview' | 'apply'): Promise<OrgChartImportResult> {
    if (!file) {
      throw new BadRequestException('Debes adjuntar el archivo CSV en el campo "file".');
    }

    let parsed: ReturnType<typeof parseOrgChartCsv>;
    try {
      parsed = parseOrgChartCsv(file.buffer);
    } catch (error) {
      if (error instanceof OrgChartFileError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    if (!parsed.ok) {
      return { mode, ok: false, saved: false, rowCount: parsed.rowCount, errors: parsed.errors, summary: null };
    }

    const organization = await this.currentOrganization.getCurrentOrganization();
    const organizationId = organization.organizationId;
    const today = todayAsDate();

    const existing = await this.loadExisting(organizationId, today);
    const { changes, errors } = this.buildChangeSet(parsed.plan, existing);
    if (errors.length > 0) {
      return { mode, ok: false, saved: false, rowCount: parsed.rowCount, errors, summary: null };
    }

    const summary = this.summarize(parsed.plan, changes, existing);

    if (mode === 'preview') {
      return { mode, ok: true, saved: false, rowCount: parsed.rowCount, errors: [], summary };
    }

    await this.prisma.$transaction(
      async (tx) => {
        await this.apply(tx, organizationId, parsed.plan, changes, today);
        await tx.auditEvent.create({
          data: {
            organizationId,
            actorMemberId: organization.memberId,
            action: 'ORG_CHART_IMPORTED',
            entityType: 'Organization',
            entityId: organizationId,
            changes: {
              fileName: file.originalname,
              rows: parsed.rowCount,
              departmentsCreated: summary.departments.created.length,
              positionsCreated: summary.positions.created.length,
              positionsParentChanged: summary.positions.parentChanged.length,
              employeesCreated: summary.employees.created.length,
              employeesPositionChanged: summary.employees.positionChanged.length,
              employeesNotInFile: summary.notInFile.length,
            },
          },
        });
      },
      // Un organigrama grande son muchas operaciones: se da más tiempo que el valor por defecto (5 s).
      { timeout: 60_000 },
    );

    return { mode, ok: true, saved: true, rowCount: parsed.rowCount, errors: [], summary };
  }

  // ---------- Leer la base ----------

  private async loadExisting(organizationId: string, today: Date): Promise<ExistingData> {
    const [departments, allDepartmentCodes, positions, allPositionCodes, employees, archivedEmployees] = await Promise.all([
      this.prisma.department.findMany({ where: { organizationId, archivedAt: null }, select: { id: true, name: true } }),
      // Los códigos son únicos también entre archivados: se consideran todos al generar códigos nuevos.
      this.prisma.department.findMany({ where: { organizationId }, select: { code: true } }),
      this.prisma.position.findMany({
        where: { organizationId, archivedAt: null },
        select: { id: true, title: true, parentPositionId: true, department: { select: { name: true } } },
      }),
      this.prisma.position.findMany({ where: { organizationId }, select: { code: true } }),
      this.prisma.employee.findMany({
        where: { organizationId, archivedAt: null },
        select: {
          id: true,
          fullName: true,
          employeeCode: true,
          positionAssignments: { where: activeAssignmentWhere(today), select: { positionId: true } },
        },
      }),
      this.prisma.employee.findMany({
        where: { organizationId, archivedAt: { not: null }, employeeCode: { not: null } },
        select: { employeeCode: true },
      }),
    ]);

    return {
      departments,
      departmentCodes: new Set(allDepartmentCodes.map((d) => d.code)),
      positions: positions.map((p) => ({
        id: p.id,
        title: p.title,
        departmentName: p.department.name,
        parentPositionId: p.parentPositionId,
      })),
      positionCodes: new Set(allPositionCodes.map((p) => p.code)),
      employees: employees.map((e) => ({
        id: e.id,
        fullName: e.fullName,
        employeeCode: e.employeeCode,
        positionIds: e.positionAssignments.map((a) => a.positionId),
      })),
      archivedEmployeeCodes: new Set(archivedEmployees.map((e) => normalizeKey(e.employeeCode ?? ''))),
    };
  }

  // ---------- Comparar archivo y base ----------

  private buildChangeSet(plan: OrgChartPlan, existing: ExistingData): { changes: ChangeSet; errors: OrgChartError[] } {
    const errors: OrgChartError[] = [];

    // Áreas: se reconocen por nombre (sin importar mayúsculas ni tildes).
    const departmentsByKey = new Map(existing.departments.map((d) => [normalizeKey(d.name), d]));
    const departments = new Map<string, DepartmentAction>();
    for (const department of plan.departments) {
      const found = departmentsByKey.get(department.key);
      departments.set(
        department.key,
        found
          ? { kind: 'existing', id: found.id, name: found.name }
          : { kind: 'create', name: department.name, code: generateCode(department.name, existing.departmentCodes) },
      );
    }

    // Cargos: se reconocen por área + título.
    const positionsByKey = new Map(existing.positions.map((p) => [positionKeyOf(p.departmentName, p.title), p]));
    const positions = new Map<string, PositionAction>();
    for (const position of plan.positions) {
      const found = positionsByKey.get(position.key);
      positions.set(
        position.key,
        found
          ? {
              kind: 'existing',
              id: found.id,
              title: found.title,
              departmentKey: position.departmentKey,
              currentParentId: found.parentPositionId,
            }
          : {
              kind: 'create',
              title: position.title,
              departmentKey: position.departmentKey,
              code: generateCode(position.title, existing.positionCodes),
            },
      );
    }

    // Personas: primero por código; si la fila no trae código (o no coincide), por nombre entre quienes no tienen código.
    const byCode = new Map(
      existing.employees.filter((e) => e.employeeCode).map((e) => [normalizeKey(e.employeeCode ?? ''), e]),
    );
    const byName = new Map<string, ExistingData['employees']>();
    for (const employee of existing.employees) {
      const key = normalizeKey(employee.fullName);
      byName.set(key, [...(byName.get(key) ?? []), employee]);
    }

    const employees: EmployeeAction[] = [];
    // Fila del archivo que ya tomó a cada persona de la base (para no asignar dos filas a la misma persona).
    const matchedLine = new Map<string, number>();

    for (const row of plan.employees) {
      let found = row.code ? byCode.get(normalizeKey(row.code)) : undefined;
      let setCode: string | null = null;

      if (!found && row.code && existing.archivedEmployeeCodes.has(normalizeKey(row.code))) {
        errors.push({
          lines: [row.line],
          message: `El código "${row.code}" pertenece a una persona archivada. Usa otro código o reactiva a esa persona.`,
        });
        continue;
      }

      if (!found) {
        const sameName = byName.get(normalizeKey(row.fullName)) ?? [];
        // Si la fila trae código, solo se aceptan coincidencias por nombre de personas sin código (se les asigna).
        const candidates = row.code ? sameName.filter((e) => e.employeeCode === null) : sameName;
        if (candidates.length > 1) {
          errors.push({
            lines: [row.line],
            message: `En la base ya hay ${candidates.length} personas llamadas "${row.fullName}". Agrega la columna "codigo" para indicar cuál es.`,
          });
          continue;
        }
        found = candidates[0];
        if (found && row.code) {
          setCode = row.code;
        }
      }

      if (found) {
        const previousLine = matchedLine.get(found.id);
        if (previousLine !== undefined) {
          errors.push({
            lines: [previousLine, row.line],
            message: `Las filas ${previousLine} y ${row.line} corresponden a la misma persona de la base ("${found.fullName}"). Revisa los nombres y códigos.`,
          });
          continue;
        }
        matchedLine.set(found.id, row.line);
      }

      employees.push(
        found
          ? {
              kind: 'existing',
              id: found.id,
              fullName: found.fullName,
              positionKey: row.positionKey,
              currentPositionIds: found.positionIds,
              setCode,
            }
          : { kind: 'create', fullName: row.fullName, code: row.code, positionKey: row.positionKey },
      );
    }

    return { changes: { departments, positions, employees }, errors };
  }

  // ---------- Resumen para mostrar (preview y apply) ----------

  private summarize(plan: OrgChartPlan, changes: ChangeSet, existing: ExistingData): OrgChartImportSummary {
    const departmentName = (key: string) => {
      const action = changes.departments.get(key);
      return action ? action.name : key;
    };
    const positionTitleById = new Map(existing.positions.map((p) => [p.id, p.title]));
    const positionLabel = (key: string | null) => {
      if (key === null) return null;
      const action = changes.positions.get(key);
      return action ? `${action.title} (${departmentName(action.departmentKey)})` : key;
    };

    const created: OrgChartImportSummary['positions']['created'] = [];
    const parentChanged: OrgChartImportSummary['positions']['parentChanged'] = [];
    let positionsUnchanged = 0;

    for (const position of plan.positions) {
      const action = changes.positions.get(position.key);
      if (!action) continue;
      if (action.kind === 'create') {
        created.push({ title: action.title, department: departmentName(action.departmentKey) });
        continue;
      }
      const wantedParent = position.parentKey === null ? null : changes.positions.get(position.parentKey);
      const wantedParentId = wantedParent?.kind === 'existing' ? wantedParent.id : wantedParent ? 'nuevo' : null;
      if (wantedParentId === action.currentParentId) {
        positionsUnchanged++;
      } else {
        parentChanged.push({
          title: action.title,
          department: departmentName(action.departmentKey),
          from: action.currentParentId ? (positionTitleById.get(action.currentParentId) ?? null) : null,
          to: positionLabel(position.parentKey),
        });
      }
    }

    const employeesCreated: OrgChartImportSummary['employees']['created'] = [];
    const positionChanged: OrgChartImportSummary['employees']['positionChanged'] = [];
    let employeesUnchanged = 0;
    const matchedIds = new Set<string>();

    for (const employee of changes.employees) {
      const target = changes.positions.get(employee.positionKey);
      const targetLabel = positionLabel(employee.positionKey) ?? '';
      if (employee.kind === 'create') {
        employeesCreated.push({ fullName: employee.fullName, position: targetLabel });
        continue;
      }
      matchedIds.add(employee.id);
      const keepsPosition =
        target?.kind === 'existing' &&
        employee.currentPositionIds.length === 1 &&
        employee.currentPositionIds[0] === target.id;
      if (keepsPosition) {
        employeesUnchanged++;
      } else {
        const from = employee.currentPositionIds.map((id) => positionTitleById.get(id) ?? '').join(', ');
        positionChanged.push({ fullName: employee.fullName, from: from || null, to: targetLabel });
      }
    }

    const notInFile = existing.employees
      .filter((e) => !matchedIds.has(e.id))
      .map((e) => ({
        fullName: e.fullName,
        position: e.positionIds.map((id) => positionTitleById.get(id) ?? '').join(', ') || null,
      }));

    return {
      departments: {
        created: [...changes.departments.values()].filter((d) => d.kind === 'create').map((d) => d.name),
        existing: [...changes.departments.values()].filter((d) => d.kind === 'existing').length,
      },
      positions: { created, parentChanged, unchanged: positionsUnchanged },
      employees: { created: employeesCreated, positionChanged, unchanged: employeesUnchanged },
      notInFile,
    };
  }

  // ---------- Guardar ----------

  private async apply(
    tx: Prisma.TransactionClient,
    organizationId: string,
    plan: OrgChartPlan,
    changes: ChangeSet,
    today: Date,
  ): Promise<void> {
    // 1. Áreas nuevas.
    const departmentIds = new Map<string, string>();
    for (const [key, action] of changes.departments) {
      if (action.kind === 'existing') {
        departmentIds.set(key, action.id);
      } else {
        const created = await tx.department.create({
          data: { organizationId, code: action.code, name: action.name },
          select: { id: true },
        });
        departmentIds.set(key, created.id);
      }
    }

    // 2. Cargos nuevos (primero sin cargo superior: así no importa el orden).
    const positionIds = new Map<string, string>();
    for (const [key, action] of changes.positions) {
      if (action.kind === 'existing') {
        positionIds.set(key, action.id);
      } else {
        const departmentId = departmentIds.get(action.departmentKey);
        if (!departmentId) throw new Error(`Área no resuelta: ${action.departmentKey}`);
        const created = await tx.position.create({
          data: { organizationId, code: action.code, title: action.title, departmentId },
          select: { id: true },
        });
        positionIds.set(key, created.id);
      }
    }

    // 3. Cargo superior de cada cargo del archivo (el archivo ya se revisó sin ciclos).
    for (const position of plan.positions) {
      const id = positionIds.get(position.key);
      const parentId = position.parentKey === null ? null : (positionIds.get(position.parentKey) ?? null);
      const action = changes.positions.get(position.key);
      if (!id || !action) continue;
      if (action.kind === 'existing' && action.currentParentId === parentId) continue;
      if (action.kind === 'create' && parentId === null) continue;
      await tx.position.update({ where: { id }, data: { parentPositionId: parentId } });
    }

    // 4. Personas y su cargo vigente.
    for (const employee of changes.employees) {
      const positionId = positionIds.get(employee.positionKey);
      if (!positionId) throw new Error(`Cargo no resuelto: ${employee.positionKey}`);

      let employeeId: string;
      if (employee.kind === 'create') {
        const created = await tx.employee.create({
          data: { organizationId, fullName: employee.fullName, employeeCode: employee.code },
          select: { id: true },
        });
        employeeId = created.id;
      } else {
        employeeId = employee.id;
        if (employee.setCode) {
          await tx.employee.update({ where: { id: employeeId }, data: { employeeCode: employee.setCode } });
        }
      }

      await setCurrentPosition(tx, organizationId, employeeId, positionId, today);
    }
  }
}
