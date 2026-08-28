import { Body, Controller, Get, Param, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { HouseholdService } from '../household/household.service';
import { ProviderSendService } from '../../services/provider-hub/provider-send.service';
import { GeneratePackDto } from './dto/generate-pack.dto';
import { SendPackDto } from './dto/send-pack.dto';

// Household-scoped: everything here concerns one client's LOA/provider
// pack. Firm-wide compliance viewing lives on ComplianceProviderActionController.
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('households/:householdId/provider-pack')
@Roles(Role.ADMIN, Role.ADVISER)
export class ProviderPackController {
  constructor(
    private readonly households: HouseholdService,
    private readonly send: ProviderSendService,
  ) {}

  // "Auto-fill preview" (spec UI requirement) — builds the pack and
  // returns the manifest/warnings without emailing anything, so the
  // adviser can check what's about to go out before committing to Send.
  @Post('preview')
  async preview(@Param('householdId') householdId: string, @Body() dto: GeneratePackDto, @CurrentUser() user: AuthenticatedUser) {
    await this.households.ensureAccessible(householdId, user as any);
    const built = await this.send.generate({ householdId, providerId: dto.providerId, loaTemplateId: dto.loaTemplateId, adviserId: user.userId });
    return { manifest: built.manifest, missingRequired: built.missingRequired };
  }

  @Post('generate')
  async generate(@Param('householdId') householdId: string, @Body() dto: GeneratePackDto, @CurrentUser() user: AuthenticatedUser, @Res() res: Response) {
    await this.households.ensureAccessible(householdId, user as any);
    const built = await this.send.generate({ householdId, providerId: dto.providerId, loaTemplateId: dto.loaTemplateId, adviserId: user.userId });
    res.set({ 'Content-Type': 'application/zip', 'Content-Disposition': 'attachment; filename="provider_pack.zip"' });
    res.send(built.zip);
  }

  @Post('send')
  async sendToProvider(@Param('householdId') householdId: string, @Body() dto: SendPackDto, @CurrentUser() user: AuthenticatedUser) {
    await this.households.ensureAccessible(householdId, user as any);
    return this.send.send({
      householdId, providerId: dto.providerId, loaTemplateId: dto.loaTemplateId,
      adviserId: user.userId, overrideUnverifiedEmail: dto.overrideUnverifiedEmail,
    });
  }

  @Get('actions')
  async actions(@Param('householdId') householdId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.households.ensureAccessible(householdId, user as any);
    return this.send.listActions(householdId);
  }
}
