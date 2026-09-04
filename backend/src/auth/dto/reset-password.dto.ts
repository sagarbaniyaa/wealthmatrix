import { IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  // The raw token and the firm it belongs to both travel in the emailed
  // link — same "identifier embedded in the URL" pattern Telephony's
  // status-callback webhook already uses, for the same reason: this
  // request has no other way to establish tenant context before
  // looking anything up.
  @IsString()
  firmId: string;

  @IsString()
  token: string;

  @IsString()
  @MinLength(8)
  newPassword: string;
}
