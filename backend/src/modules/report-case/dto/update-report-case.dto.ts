import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateReportCaseDto {
  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsIn(['draft', 'final']) status?: 'draft' | 'final';
}
