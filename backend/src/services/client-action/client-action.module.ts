import { Module } from '@nestjs/common';
import { HouseholdModule } from '../../modules/household/household.module';
import { ClientDocumentModule } from '../../modules/client-document/client-document.module';
import { FactFindModule } from '../../modules/fact-find/fact-find.module';
import { DfmRecommendationModule } from '../dfm-recommendation/dfm-recommendation.module';
import { ClientActionService } from './client-action.service';
import { ClientActionController } from '../../modules/client-action/client-action.controller';

@Module({
  imports: [HouseholdModule, ClientDocumentModule, FactFindModule, DfmRecommendationModule],
  providers: [ClientActionService],
  controllers: [ClientActionController],
  exports: [ClientActionService],
})
export class ClientActionModule {}
