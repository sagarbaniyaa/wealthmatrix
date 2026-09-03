import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { HouseholdService } from '../household/household.service';
import { ReportBuilderService } from '../../services/report-builder/report-builder.service';
import { GenerateReportCaseDto } from './dto/generate-report-case.dto';
import { UpdateReportCaseDto } from './dto/update-report-case.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Report Case')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('households/:householdId/report-cases')
@Roles(Role.ADMIN, Role.ADVISER)
export class ReportCaseController {
  constructor(
    private readonly builder: ReportBuilderService,
    private readonly households: HouseholdService,
  ) {}

  @Get()
  async findAll(@Param('householdId') householdId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.households.ensureAccessible(householdId, user as any);
    return this.builder.listForHousehold(householdId);
  }

  @Get(':id')
  async findOne(@Param('householdId') householdId: string, @Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.households.ensureAccessible(householdId, user as any);
    return this.builder.findOneOrFail(id);
  }

  @Post()
  async generate(@Param('householdId') householdId: string, @Body() dto: GenerateReportCaseDto, @CurrentUser() user: AuthenticatedUser) {
    await this.households.ensureAccessible(householdId, user as any);
    return this.builder.generate({
      householdId, reportTemplateId: dto.reportTemplateId, caseDetails: dto.caseDetails, adviserId: user.userId,
    });
  }

  @Patch(':id')
  async update(@Param('householdId') householdId: string, @Param('id') id: string, @Body() dto: UpdateReportCaseDto, @CurrentUser() user: AuthenticatedUser) {
    await this.households.ensureAccessible(householdId, user as any);
    return this.builder.updateContent(id, dto.content, dto.status);
  }

  @Delete(':id')
  async remove(@Param('householdId') householdId: string, @Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.households.ensureAccessible(householdId, user as any);
    return this.builder.remove(id);
  }
}
