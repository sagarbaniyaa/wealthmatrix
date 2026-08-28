import { IsOptional, IsString, IsUUID } from 'class-validator';
export class CreateHouseholdMemberDto {
  @IsUUID() householdId: string;
  @IsUUID() personId: string;
  @IsOptional() @IsString() relationship?: string;
}
