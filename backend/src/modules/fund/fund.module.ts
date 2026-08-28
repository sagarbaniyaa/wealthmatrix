import { Module } from '@nestjs/common';
import { FundService } from './fund.service';
import { FundController } from './fund.controller';
import { FundResearchModule } from '../../services/fund-research/fund-research.module';

@Module({
  imports: [FundResearchModule],
  providers: [FundService],
  controllers: [FundController],
  exports: [FundService],
})
export class FundModule {}
