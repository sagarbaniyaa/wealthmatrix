import { Module } from '@nestjs/common';
import { ScenarioService } from './scenario.service';
import { ScenarioController } from './scenario.controller';
import { ScenarioEngineModule } from '../../services/scenario-engine/scenario-engine.module';

@Module({
  imports: [ScenarioEngineModule],
  providers: [ScenarioService],
  controllers: [ScenarioController],
  exports: [ScenarioService],
})
export class ScenarioModule {}
