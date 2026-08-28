import { IsArray, IsBoolean, IsEmail, IsOptional, IsString } from 'class-validator';

export class CreateProviderDto {
  @IsString() providerName: string;
  @IsEmail() providerEmail: string;
  @IsOptional() @IsEmail() servicingEmail?: string;
  @IsOptional() @IsEmail() newBusinessEmail?: string;
  @IsOptional() @IsBoolean() emailVerified?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) requiredDocuments?: string[];
}
