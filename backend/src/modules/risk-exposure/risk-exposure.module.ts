import { Module } from '@nestjs/common';
import { RiskExposureService } from './risk-exposure.service';
import { RiskExposureController } from './risk-exposure.controller';

@Module({ providers: [RiskExposureService], controllers: [RiskExposureController], exports: [RiskExposureService] })
export class RiskExposureModule {}
