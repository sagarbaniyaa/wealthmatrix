import { IsOptional, IsUUID } from 'class-validator';

export class GeneratePackDto {
  @IsUUID() providerId: string;
  @IsOptional() @IsUUID() loaTemplateId?: string;
}
