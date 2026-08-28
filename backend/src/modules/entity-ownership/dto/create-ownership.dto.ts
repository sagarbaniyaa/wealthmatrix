import { IsDateString, IsNumber, IsOptional, IsString, IsUUID, Max, Min, ValidateIf } from 'class-validator';

export class CreateOwnershipDto {
  @ValidateIf((o) => !o.ownerEntityId) @IsUUID() ownerPersonId?: string;
  @ValidateIf((o) => !o.ownerPersonId) @IsUUID() ownerEntityId?: string;
  @IsUUID() ownedEntityId: string;
  @IsNumber() @Min(0) @Max(100) ownershipPct: number;
  @IsOptional() @IsString() ownershipClass?: string;
  @IsDateString() validFrom: string;
  @IsOptional() @IsDateString() validTo?: string;
  @IsOptional() @IsUUID() structureVersionId?: string;
}
