import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { config } from '../../config';
import { parsePositionSkillsInput } from './position-skills-input';
import { PositionSkillItem, SkillItem, SkillsService } from './skills.service';

const positionIdPipe = new ParseUUIDPipe({
  exceptionFactory: () => new BadRequestException('El id del cargo no es válido.'),
});

// Catálogo de competencias. La lógica está en skills.service.ts.
@Controller('skills')
export class SkillsController {
  constructor(private readonly skills: SkillsService) {}

  // GET /api/skills
  @Get()
  listSkills(): Promise<SkillItem[]> {
    return this.skills.listSkills();
  }
}

// Requisitos de competencias de un cargo (position_skills).
@Controller('positions/:id/skills')
export class PositionSkillsController {
  constructor(private readonly skills: SkillsService) {}

  // GET /api/positions/:id/skills
  @Get()
  getPositionSkills(@Param('id', positionIdPipe) positionId: string): Promise<PositionSkillItem[]> {
    return this.skills.getPositionSkills(positionId);
  }

  // PUT /api/positions/:id/skills: reemplaza todos los requisitos del cargo.
  @Put()
  replacePositionSkills(@Param('id', positionIdPipe) positionId: string, @Body() body: unknown): Promise<PositionSkillItem[]> {
    return this.skills.replacePositionSkills(positionId, parsePositionSkillsInput(body));
  }
}

// Perfiles de cargo desde CSV: competencias requeridas de varios cargos a la vez.
@Controller('position-profiles')
export class PositionProfilesController {
  constructor(private readonly skills: SkillsService) {}

  // POST /api/position-profiles/import?mode=preview   → valida y muestra qué cambiaría, sin guardar
  // POST /api/position-profiles/import?mode=apply     → guarda todo (o nada, si hay errores)
  // Formulario multipart con el campo "file" (CSV).
  @Post('import')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: config.maxUploadBytes, files: 1 },
      defParamCharset: 'utf8',
    }),
  )
  importProfiles(@UploadedFile() file: Express.Multer.File | undefined, @Query('mode') mode: string | undefined) {
    if (mode !== 'preview' && mode !== 'apply') {
      throw new BadRequestException('Indica "mode=preview" (solo revisar) o "mode=apply" (guardar).');
    }
    return this.skills.importPositionProfiles(file, mode);
  }
}
