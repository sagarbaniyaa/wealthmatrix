import { IsNumber, IsUUID, Min } from 'class-validator';

export class FundImpactDto {
  @IsUUID() householdId: string;
  @IsUUID() fundAId: string;
  @IsUUID() fundBId: string;
  @IsNumber() @Min(0) switchAmount: number;
}
