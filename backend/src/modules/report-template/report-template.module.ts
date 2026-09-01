import { Module } from '@nestjs/common';
import { ReportTemplateService } from '../../services/report-builder/report-template.service';
import { DocumentTextExtractorService } from '../../services/report-builder/document-text-extractor.service';
import { ReportTemplateController } from './report-template.controller';

@Module({
  providers: [ReportTemplateService, DocumentTextExtractorService],
  controllers: [ReportTemplateController],
  exports: [ReportTemplateService],
})
export class ReportTemplateModule {}
