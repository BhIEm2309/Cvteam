import { BadRequestException, Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { PositionsService } from './positions.service';
import { parseCreatePositionInput, parseUpdatePositionInput } from './position-input';

// Valida que el :id de la ruta sea un UUID; si no, responde 400 con un mensaje en español.
const positionIdPipe = new ParseUUIDPipe({
  exceptionFactory: () => new BadRequestException('El id del cargo no es válido.'),
});

// Rutas del módulo de cargos (puestos). La lógica está en positions.service.ts.
@Controller('positions')
export class PositionsController {
  constructor(private readonly positionsService: PositionsService) {}

  // GET /api/positions
  @Get()
  listPositions() {
    return this.positionsService.listPositions();
  }

  // GET /api/positions/:id
  @Get(':id')
  getPosition(@Param('id', positionIdPipe) id: string) {
    return this.positionsService.getPosition(id);
  }

  // POST /api/positions
  // Cuerpo JSON: { "code": "TEC-SR", "title": "Técnico senior", "departmentId": "...", "parentPositionId": null,
  //                "targetHeadcount": 8, "criticality": "HIGH" }
  @Post()
  createPosition(@Body() body: unknown) {
    const input = parseCreatePositionInput(body);
    return this.positionsService.createPosition(input);
  }

  // PATCH /api/positions/:id
  // Cuerpo JSON con solo los campos a cambiar, por ejemplo: { "parentPositionId": "..." }
  @Patch(':id')
  updatePosition(@Param('id', positionIdPipe) id: string, @Body() body: unknown) {
    const input = parseUpdatePositionInput(body);
    return this.positionsService.updatePosition(id, input);
  }

  // DELETE /api/positions/:id
  // No borra el registro: lo archiva.
  @Delete(':id')
  archivePosition(@Param('id', positionIdPipe) id: string) {
    return this.positionsService.archivePosition(id);
  }
}
