import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';
export class CreateStructureVersionDto {
  @IsUUID() householdId: string;
  @IsString() label: string;
  @IsDateString() effectiveDate: string;
  @IsOptional() @IsString() notes?: string;
}
