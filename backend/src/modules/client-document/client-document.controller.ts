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
import { ClientDocumentService } from './client-document.service';
import { UploadClientDocumentDto } from './dto/upload-client-document.dto';
import { HouseholdService } from '../household/household.service';

// Nested under a household because every document belongs to exactly one
// client — KYC, ID proof, address proof, bank statements. These are things
// nobody can legitimately generate on the platform's behalf, so this
// endpoint only ever stores what an adviser actually uploads (see
// UPLOADABLE_DOCUMENT_TYPES) — fact-find/policy-summary/adviser-details
// are produced by DocumentGeneratorService instead, never uploaded here.
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('households/:householdId/documents')
@Roles(Role.ADMIN, Role.ADVISER)
export class ClientDocumentController {
  constructor(
    private readonly documents: ClientDocumentService,
    private readonly households: HouseholdService,
  ) {}

  @Get()
  async findAll(@Param('householdId') householdId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.households.ensureAccessible(householdId, user as any);
    return this.documents.listForHousehold(householdId);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 15 * 1024 * 1024 } })) // 15MB — plenty for a scanned ID/bank statement, keeps memory storage sane
  async upload(
    @Param('householdId') householdId: string,
    @Body() dto: UploadClientDocumentDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.households.ensureAccessible(householdId, user as any);
    if (!file) throw new BadRequestException('No file uploaded.');

    return this.documents.saveUploaded({
      householdId,
      documentType: dto.documentType,
      fileName: file.originalname,
      mimeType: file.mimetype,
      fileData: file.buffer,
      uploadedBy: user.userId,
    });
  }

  @Get(':documentId/download')
  async download(@Param('householdId') householdId: string, @Param('documentId') documentId: string, @CurrentUser() user: AuthenticatedUser, @Res() res: Response) {
    await this.households.ensureAccessible(householdId, user as any);
    const doc = await this.documents.findWithBytes(documentId);
    res.set({
      'Content-Type': doc.mimeType,
      'Content-Disposition': `attachment; filename="${doc.fileName}"`,
    });
    res.send(doc.fileData);
  }

  @Delete(':documentId')
  async remove(@Param('householdId') householdId: string, @Param('documentId') documentId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.households.ensureAccessible(householdId, user as any);
    return this.documents.remove(documentId);
  }
}
