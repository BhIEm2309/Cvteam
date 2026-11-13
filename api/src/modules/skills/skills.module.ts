import { Module } from '@nestjs/common';
import { PositionSkillsController, SkillsController } from './skills.controller';
import { SkillsService } from './skills.service';

// Catálogo de competencias y requisitos de competencias por cargo.
@Module({
  controllers: [SkillsController, PositionSkillsController],
  providers: [SkillsService],
})
export class SkillsModule {}
