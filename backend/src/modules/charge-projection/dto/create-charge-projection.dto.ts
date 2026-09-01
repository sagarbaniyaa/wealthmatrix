import { IsNumber, IsObject, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class OldArrangementDto {
  @IsString() name: string;
  @IsNumber() @Min(0) currentValue: number;
  @IsNumber() @Min(0) @Max(100) ongoingChargePct: number;
  @IsNumber() @Min(0) @Max(100) exitPenaltyPct: number;
}

class NewArrangementDto {
  @IsString() name: string;
  @IsNumber() @Min(0) @Max(100) ongoingChargePct: number;
  @IsNumber() @Min(0) @Max(100) initialChargePct: number;
}

class AssumptionsDto {
  @IsNumber() @Min(1) @Max(60) projectionYears: number;
  @IsNumber() @Min(-20) @Max(20) grossGrowthRatePct: number;
}

export class CreateChargeProjectionDto {
  @IsOptional() @IsString() name?: string;
  @IsObject() @ValidateNested() @Type(() => OldArrangementDto) oldArrangement: OldArrangementDto;
  @IsObject() @ValidateNested() @Type(() => NewArrangementDto) newArrangement: NewArrangementDto;
  @IsObject() @ValidateNested() @Type(() => AssumptionsDto) assumptions: AssumptionsDto;
}
