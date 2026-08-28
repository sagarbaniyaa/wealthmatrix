import { Module } from '@nestjs/common';
import { FactFindService } from '../../services/fact-find/fact-find.service';
import { FactFindController, RiskQuestionnaireController } from './fact-find.controller';
import { HouseholdModule } from '../household/household.module';

@Module({
  imports: [HouseholdModule],
  providers: [FactFindService],
  controllers: [FactFindController, RiskQuestionnaireController],
  exports: [FactFindService],
})
export class FactFindModule {}
