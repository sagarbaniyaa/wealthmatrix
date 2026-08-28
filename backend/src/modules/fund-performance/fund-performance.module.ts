import { Module } from '@nestjs/common';
import { FundPerformanceService } from './fund-performance.service';
import { FundPerformanceController } from './fund-performance.controller';

@Module({ providers: [FundPerformanceService], controllers: [FundPerformanceController], exports: [FundPerformanceService] })
export class FundPerformanceModule {}
