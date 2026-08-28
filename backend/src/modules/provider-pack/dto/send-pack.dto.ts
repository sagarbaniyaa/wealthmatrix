import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class SendPackDto {
  @IsUUID() providerId: string;
  @IsOptional() @IsUUID() loaTemplateId?: string;
  @IsOptional() @IsBoolean() overrideUnverifiedEmail?: boolean;
}
