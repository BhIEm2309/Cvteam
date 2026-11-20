import { Module } from '@nestjs/common';
import { PositionProfilesController, PositionSkillsController, SkillsController } from './skills.controller';
import { SkillsService } from './skills.service';

// Catálogo de competencias y requisitos de competencias por cargo (a mano o desde un CSV de perfiles).
@Module({
  controllers: [SkillsController, PositionSkillsController, PositionProfilesController],
  providers: [SkillsService],
})
export class SkillsModule {}
