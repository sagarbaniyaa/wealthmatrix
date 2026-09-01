import { Module } from '@nestjs/common';
import { HouseholdModule } from '../../modules/household/household.module';
import { PortfolioLookThroughService } from './portfolio-lookthrough.service';
import { PortfolioLookThroughController } from '../../modules/portfolio-lookthrough/portfolio-lookthrough.controller';

@Module({
  imports: [HouseholdModule],
  providers: [PortfolioLookThroughService],
  controllers: [PortfolioLookThroughController],
  exports: [PortfolioLookThroughService],
})
export class PortfolioLookThroughModule {}
