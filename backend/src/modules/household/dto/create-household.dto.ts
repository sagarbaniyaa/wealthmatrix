import { IsOptional, IsString, IsUUID } from 'class-validator';
export class CreateHouseholdDto {
  @IsString() name: string;
  @IsOptional() @IsUUID() primaryAdviserId?: string;
}
