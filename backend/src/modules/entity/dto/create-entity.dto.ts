import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { EntityType } from '../../../common/enums/domain.enums';
export class CreateEntityDto {
  @IsString() name: string;
  @IsEnum(EntityType) entityType: EntityType;
  @IsOptional() @IsString() jurisdiction?: string;
  @IsOptional() @IsString() registrationNumber?: string;
  @IsUUID() baseCurrencyId: string;
  @IsOptional() @IsUUID() householdId?: string;
}
