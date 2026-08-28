import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  // Firm slug/id needed at login since email is only unique per-firm, not globally.
  @IsString()
  firmId: string;
}
