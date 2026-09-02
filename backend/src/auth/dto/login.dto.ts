import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  // Firm slug/id disambiguates email (unique per-firm, not globally) once
  // multiple firms exist. Optional: AuthService auto-resolves it when
  // there's exactly one firm in the system — which is every demo/single-
  // tenant deployment — so the login form doesn't need to ask for it.
  @IsOptional()
  @IsString()
  firmId?: string;
}
