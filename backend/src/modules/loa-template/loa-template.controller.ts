import {
  BadRequestException, Body, Controller, Delete, Get, Param, Post, Res, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { LoaTemplateService } from '../../services/provider-hub/loa-template.service';
import { UploadLoaTemplateDto } from './dto/upload-loa-template.dto';

const ALLOWED_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/pdf',
]);

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('loa-templates')
@Roles(Role.ADMIN, Role.ADVISER)
export class LoaTemplateController {
  constructor(private readonly templates: LoaTemplateService) {}

  @Get() findAll() { return this.templates.listActive(); }

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async upload(@Body() dto: UploadLoaTemplateDto, @UploadedFile() file: Express.Multer.File, @CurrentUser() user: AuthenticatedUser) {
    if (!file) throw new BadRequestException('No file uploaded.');
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException('LOA templates must be a .docx (with {{token}} markers) or a fillable PDF form.');
    }
    let fieldMap: Record<string, string> | null = null;
    if (dto.fieldMap) {
      try { fieldMap = JSON.parse(dto.fieldMap); } catch { throw new BadRequestException('fieldMap must be valid JSON.'); }
    }
    return this.templates.upload({
      name: dto.name, fileName: file.originalname, mimeType: file.mimetype, fileData: file.buffer, fieldMap, uploadedBy: user.userId,
    });
  }

  @Get(':id/download')
  async download(@Param('id') id: string, @Res() res: Response) {
    const template = await this.templates.findWithBytes(id);
    res.set({ 'Content-Type': template.mimeType, 'Content-Disposition': `attachment; filename="${template.fileName}"` });
    res.send(template.fileData);
  }

  @Delete(':id') remove(@Param('id') id: string) { return this.templates.remove(id); }
}
