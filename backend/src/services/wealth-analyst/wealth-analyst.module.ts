import { Module } from '@nestjs/common';
import { WealthAnalystService } from './wealth-analyst.service';
import { ClaudeClientService } from './claude-client.service';
import { WealthConsolidationModule } from '../wealth-consolidation/wealth-consolidation.module';
import { EntityStructureModule } from '../entity-structure/entity-structure.module';
import { ComplianceLogModule } from '../../modules/compliance-log/compliance-log.module';

@Module({
  imports: [WealthConsolidationModule, EntityStructureModule, ComplianceLogModule],
  providers: [WealthAnalystService, ClaudeClientService],
  exports: [WealthAnalystService],
})
export class WealthAnalystModule {}