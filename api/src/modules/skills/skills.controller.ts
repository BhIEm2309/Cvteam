import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Put } from '@nestjs/common';
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
