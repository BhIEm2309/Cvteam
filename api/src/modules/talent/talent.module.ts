import { Module } from '@nestjs/common';
import { TalentController } from './talent.controller';
import { TalentService } from './talent.service';

// Directorio de Talento: lectura de personas, cargos y competencias confirmadas.
@Module({
  controllers: [TalentController],
  providers: [TalentService],
})
export class TalentModule {}
