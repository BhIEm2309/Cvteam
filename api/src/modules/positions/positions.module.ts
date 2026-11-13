import { Module } from '@nestjs/common';
import { PositionsController } from './positions.controller';
import { PositionsService } from './positions.service';

// Módulo de cargos (puestos) y su jerarquía (cargo superior).
@Module({
  controllers: [PositionsController],
  providers: [PositionsService],
})
export class PositionsModule {}
