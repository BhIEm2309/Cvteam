import { Module } from '@nestjs/common';
import { OrgChartImportController } from './org-chart-import.controller';
import { OrgChartImportService } from './org-chart-import.service';

// Importador de organigrama desde CSV (nombre, cargo, área, jefe directo).
@Module({
  controllers: [OrgChartImportController],
  providers: [OrgChartImportService],
})
export class OrgChartImportModule {}
