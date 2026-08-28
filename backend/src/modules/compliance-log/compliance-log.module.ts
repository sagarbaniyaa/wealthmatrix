import { Module } from '@nestjs/common';
import { ComplianceLogService } from './compliance-log.service';
import { ComplianceLogController } from './compliance-log.controller';

@Module({ providers: [ComplianceLogService], controllers: [ComplianceLogController], exports: [ComplianceLogService] })
export class ComplianceLogModule {}
