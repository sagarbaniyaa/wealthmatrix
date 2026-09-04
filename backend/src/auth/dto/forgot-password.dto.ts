import { IsEmail, IsOptional, IsString } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail()
  email: string;

  // Same auto-resolve-when-single-firm convenience as LoginDto.
  @IsOptional()
  @IsString()
  firmId?: string;
}
