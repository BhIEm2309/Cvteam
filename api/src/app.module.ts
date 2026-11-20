import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';
import { CommonModule } from './common/common.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { PositionsModule } from './modules/positions/positions.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { OrgChartImportModule } from './modules/org-chart-import/org-chart-import.module';
import { ExtractionModule } from './modules/extraction/extraction.module';
import { TalentModule } from './modules/talent/talent.module';
import { SkillsModule } from './modules/skills/skills.module';
import { DiagnosticsModule } from './modules/diagnostics/diagnostics.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    // Infraestructura compartida
    PrismaModule,
    StorageModule,
    CommonModule,

    // Módulos de negocio (agregar aquí cada módulo nuevo)
    DocumentsModule,
    DepartmentsModule,
    OrganizationsModule,
    PositionsModule,
    EmployeesModule,
    OrgChartImportModule,
    ExtractionModule,
    TalentModule,
    SkillsModule,
    DiagnosticsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
