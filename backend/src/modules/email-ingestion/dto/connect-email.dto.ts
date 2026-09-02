import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ConnectEmailDto {
  @IsString() imapHost: string;
  @IsInt() @Min(1) @Max(65535) imapPort: number;
  @IsOptional() @IsBoolean() imapSecure?: boolean;
  @IsString() username: string;
  @IsString() password: string;
}
