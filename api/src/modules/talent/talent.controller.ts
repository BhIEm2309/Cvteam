import { Controller, Get } from '@nestjs/common';
import { TalentItem } from './talent-item';
import { TalentService } from './talent.service';

// Rutas del Directorio de Talento. La lógica está en talent.service.ts.
@Controller('talent')
export class TalentController {
  constructor(private readonly talent: TalentService) {}

  // GET /api/talent: personas activas, su cargo y sus competencias confirmadas.
  @Get()
  listTalent(): Promise<TalentItem[]> {
    return this.talent.listTalent();
  }
}
