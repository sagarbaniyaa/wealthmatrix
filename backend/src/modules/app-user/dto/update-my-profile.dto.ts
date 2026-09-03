import { IsOptional, IsString } from 'class-validator';

// Deliberately narrow — an adviser can only ever update THEIR OWN
// contact details via PATCH /users/me (see controller), never another
// user's record, and never role/email/password through this route.
export class UpdateMyProfileDto {
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() displayName?: string;
}
