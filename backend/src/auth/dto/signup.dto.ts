import { IsEmail, IsString, MinLength } from 'class-validator';

// Self-service onboarding for a brand-new firm — the only way to get a
// firm onto this platform before this endpoint existed was a manual DB
// insert. The person who signs up becomes that firm's first ADMIN (there
// is no one else yet to have assigned the role), matching how a real
// admin's createForUser flow already auto-assigns/auto-provisions on
// first use elsewhere in this codebase.
export class SignupDto {
  @IsString()
  @MinLength(1)
  firmName: string;

  @IsString()
  @MinLength(1)
  adviserName: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}
