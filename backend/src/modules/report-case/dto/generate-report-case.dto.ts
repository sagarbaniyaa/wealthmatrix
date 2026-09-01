import { IsArray, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class CaseFactDto {
  @IsString() label: string;
  @IsString() value: string;
}

class CaseDetailsDto {
  @IsString() summary: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => CaseFactDto) facts: CaseFactDto[];
}

export class GenerateReportCaseDto {
  @IsUUID() reportTemplateId: string;
  @ValidateNested() @Type(() => CaseDetailsDto) caseDetails: CaseDetailsDto;
}
