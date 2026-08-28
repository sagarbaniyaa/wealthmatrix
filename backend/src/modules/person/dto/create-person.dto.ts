import { IsDateString, IsEmail, IsIn, IsOptional, IsString } from 'class-validator';

const RISK_TOLERANCES = ['conservative', 'moderate', 'aggressive'] as const;
const KYC_STATUSES = ['pending', 'verified', 'expired'] as const;

export class CreatePersonDto {
  @IsString() firstName: string;
  @IsString() lastName: string;
  @IsOptional() @IsDateString() dateOfBirth?: string;
  @IsOptional() @IsString() taxResidency?: string;
  @IsOptional() @IsString() domicile?: string;

  // Contact info
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() addressLine1?: string;
  @IsOptional() @IsString() addressLine2?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() postalCode?: string;
  @IsOptional() @IsString() country?: string;

  // KYC / risk profile
  @IsOptional() @IsIn(RISK_TOLERANCES) riskTolerance?: (typeof RISK_TOLERANCES)[number];
  @IsOptional() @IsIn(KYC_STATUSES) kycStatus?: (typeof KYC_STATUSES)[number];
  @IsOptional() @IsDateString() kycVerifiedAt?: string;
  @IsOptional() @IsString() sourceOfWealth?: string;
}
