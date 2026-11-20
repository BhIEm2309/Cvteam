import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { DiagnosticsService } from './diagnostics.service';

const recommendationIdPipe = new ParseUUIDPipe({
  exceptionFactory: () => new BadRequestException('El id de la recomendación no es válido.'),
});

// Rutas del diagnóstico. La lógica está en diagnostics.service.ts y las reglas en diagnostic-rules.ts.
@Controller('diagnostics')
export class DiagnosticsController {
  constructor(private readonly diagnostics: DiagnosticsService) {}

  // POST /api/diagnostics: ejecuta el diagnóstico con los datos actuales y lo guarda (o devuelve el mismo si nada cambió).
  @Post()
  run() {
    return this.diagnostics.runDiagnostic();
  }

  // GET /api/diagnostics/latest
  @Get('latest')
  latest() {
    return this.diagnostics.getLatest();
  }

  // PATCH /api/diagnostics/recommendations/:id { status: "ACCEPTED" | "REJECTED", notes? }
  @Patch('recommendations/:id')
  decide(@Param('id', recommendationIdPipe) recommendationId: string, @Body() body: unknown) {
    return this.diagnostics.decideRecommendation(recommendationId, body);
  }
}
