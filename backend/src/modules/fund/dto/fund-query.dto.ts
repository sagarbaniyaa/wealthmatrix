import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

const SORT_FIELDS = ['name', 'ocf', 'yieldPct', 'riskRating', 'volatilityPct', 'aum'] as const;

// Shared query shape for both the plain list endpoint and the screener —
// the screener is this same filter set with a friendlier name, not a
// separate query language.
export class FundQueryDto {
  @IsOptional() @IsString() search?: string; // matches name or ISIN
  @IsOptional() @IsString() sector?: string;
  @IsOptional() @IsString() assetClass?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(7) riskRatingMin?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(7) riskRatingMax?: number;
  @IsOptional() @Type(() => Number) ocfMax?: number;
  @IsOptional() @Type(() => Number) yieldMin?: number;
  @IsOptional() @Type(() => Number) volatilityMax?: number;

  @IsOptional() @IsIn(SORT_FIELDS) sortBy?: (typeof SORT_FIELDS)[number];
  @IsOptional() @IsIn(['ASC', 'DESC']) sortDir?: 'ASC' | 'DESC';

  @IsOptional() @Transform(({ value }) => parseInt(value, 10)) @IsInt() @Min(1) page?: number;
  @IsOptional() @Transform(({ value }) => parseInt(value, 10)) @IsInt() @Min(1) @Max(200) pageSize?: number;
}
