import { IsString } from 'class-validator';

export class UploadReportTemplateDto {
  @IsString() name: string;
  // Open-ended slug, e.g. 'pension_transfer', 'isa_setup', 'crystallisation'
  // — advisers can introduce new report types without a schema change.
  @IsString() reportType: string;
}
