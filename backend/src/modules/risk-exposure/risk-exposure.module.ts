import { Module } from '@nestjs/common';
import { RiskExposureService } from './risk-exposure.service';
import { RiskExposureController } from './risk-exposure.controller';
import { HouseholdModule } from '../household/household.module';

@Module({ imports: [HouseholdModule], providers: [RiskExposureService], controllers: [RiskExposureController], exports: [RiskExposureService] })
export class RiskExposureModule {}
