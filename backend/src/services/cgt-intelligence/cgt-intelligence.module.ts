import { Module } from '@nestjs/common';
import { HouseholdModule } from '../../modules/household/household.module';
import { FXConversionModule } from '../fx-conversion/fx-conversion.module';
import { CgtIntelligenceService } from './cgt-intelligence.service';
import { CgtAnalysisController } from '../../modules/cgt-analysis/cgt-analysis.controller';

@Module({
  imports: [HouseholdModule, FXConversionModule],
  providers: [CgtIntelligenceService],
  controllers: [CgtAnalysisController],
  exports: [CgtIntelligenceService],
})
export class CgtIntelligenceModule {}
