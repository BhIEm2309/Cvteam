import { Module } from '@nestjs/common';
import { DiagnosticsController } from './diagnostics.controller';
import { DiagnosticsService } from './diagnostics.service';

// Diagnóstico organizacional con reglas explicables (sin IA): vacantes, ajuste persona-cargo y reasignaciones propuestas.
@Module({
  controllers: [DiagnosticsController],
  providers: [DiagnosticsService],
})
export class DiagnosticsModule {}
