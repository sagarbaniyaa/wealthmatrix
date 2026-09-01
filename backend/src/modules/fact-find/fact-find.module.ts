import { Module } from '@nestjs/common';
import { FactFindService } from '../../services/fact-find/fact-find.service';
import { FactFindParserService } from '../../services/fact-find/fact-find-parser.service';
import { ClaudeClientService } from '../../services/wealth-analyst/claude-client.service';
import { FactFindController, RiskQuestionnaireController } from './fact-find.controller';
import { HouseholdModule } from '../household/household.module';

@Module({
  imports: [HouseholdModule],
  providers: [FactFindService, FactFindParserService, ClaudeClientService],
  controllers: [FactFindController, RiskQuestionnaireController],
  exports: [FactFindService, FactFindParserService],
})
export class FactFindModule {}
