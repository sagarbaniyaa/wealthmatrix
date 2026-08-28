import { Module } from '@nestjs/common';
import { FundAllocationService } from './fund-allocation.service';
import { FundAllocationController } from './fund-allocation.controller';

@Module({ providers: [FundAllocationService], controllers: [FundAllocationController], exports: [FundAllocationService] })
export class FundAllocationModule {}
