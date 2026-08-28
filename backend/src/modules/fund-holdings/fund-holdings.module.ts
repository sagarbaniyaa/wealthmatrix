import { Module } from '@nestjs/common';
import { FundHoldingsService } from './fund-holdings.service';
import { FundHoldingsController } from './fund-holdings.controller';

@Module({ providers: [FundHoldingsService], controllers: [FundHoldingsController], exports: [FundHoldingsService] })
export class FundHoldingsModule {}
