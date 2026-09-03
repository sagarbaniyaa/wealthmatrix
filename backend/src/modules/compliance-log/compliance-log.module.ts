import { Module } from '@nestjs/common';
import { ComplianceLogService } from './compliance-log.service';
import { ComplianceLogController } from './compliance-log.controller';
import { HouseholdModule } from '../household/household.module';

@Module({ imports: [HouseholdModule], providers: [ComplianceLogService], controllers: [ComplianceLogController], exports: [ComplianceLogService] })
export class ComplianceLogModule {}
