import { Module } from '@nestjs/common';
import { GdprService } from './gdpr.service';
import { ComplianceLogModule } from '../../modules/compliance-log/compliance-log.module';

@Module({
  imports: [ComplianceLogModule],
  providers: [GdprService],
  exports: [GdprService],
})
export class GdprModule {}
