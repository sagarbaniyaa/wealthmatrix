import { IsOptional, IsString } from 'class-validator';

export class UploadLoaTemplateDto {
  @IsString() name: string;
  // JSON-encoded Record<token, pdfFieldName> — only meaningful for a PDF
  // AcroForm template; sent as a string because it travels alongside the
  // file in a multipart/form-data body.
  @IsOptional() @IsString() fieldMap?: string;
}
