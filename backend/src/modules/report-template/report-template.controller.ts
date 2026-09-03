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
import { ReportTemplateService } from '../../services/report-builder/report-template.service';
import { UploadReportTemplateDto } from './dto/upload-report-template.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

const ALLOWED_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/pdf',
]);

@ApiTags('Report Template')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('report-templates')
@Roles(Role.ADMIN, Role.ADVISER)
export class ReportTemplateController {
  constructor(private readonly templates: ReportTemplateService) {}

  @Get() findAll() { return this.templates.listActive(); }

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 15 * 1024 * 1024 } }))
  async upload(@Body() dto: UploadReportTemplateDto, @UploadedFile() file: Express.Multer.File, @CurrentUser() user: AuthenticatedUser) {
    if (!file) throw new BadRequestException('No file uploaded.');
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Report templates must be a .docx or .pdf file.');
    }
    return this.templates.upload({
      name: dto.name, reportType: dto.reportType, fileName: file.originalname, mimeType: file.mimetype,
      fileData: file.buffer, uploadedBy: user.userId,
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
