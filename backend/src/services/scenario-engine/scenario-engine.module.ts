import { Module } from '@nestjs/common';
import { ScenarioEngineService } from './scenario-engine.service';
import { WealthConsolidationModule } from '../wealth-consolidation/wealth-consolidation.module';

@Module({
  imports: [WealthConsolidationModule],
  providers: [ScenarioEngineService],
  exports: [ScenarioEngineService],
})
export class ScenarioEngineModule {}
