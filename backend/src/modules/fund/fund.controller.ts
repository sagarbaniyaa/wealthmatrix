import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { FundService } from './fund.service';
import { CreateFundDto } from './dto/create-fund.dto';
import { UpdateFundDto } from './dto/update-fund.dto';
import { FundQueryDto } from './dto/fund-query.dto';
import { ImportFundsDto } from './dto/import-funds.dto';
import { SaveFundScreenDto } from './dto/save-fund-screen.dto';
import { CompareFundsDto } from './dto/compare-funds.dto';
import { FundImpactDto } from './dto/fund-impact.dto';
import { FundScreenerService } from '../../services/fund-research/fund-screener.service';
import { FundComparisonService } from '../../services/fund-research/fund-comparison.service';
import { FundSuitabilityService } from '../../services/fund-research/fund-suitability.service';
import { FundImportService } from '../../services/fund-research/fund-import.service';
import { FundAnalyticsService } from '../../services/fund-research/fund-analytics.service';

// Fund research is an adviser/admin tool — the client role has no access
// here at all (consistent with "no adviser tools in the client portal").
//
// Route order matters: every static-segment route (filter-options,
// screener, compare, suitability/:householdId, import) MUST be declared
// before ':id', or Nest matches ':id' first and swallows them.
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('funds')
@Roles(Role.ADMIN, Role.ADVISER)
export class FundController {
  constructor(
    private readonly funds: FundService,
    private readonly screener: FundScreenerService,
    private readonly comparison: FundComparisonService,
    private readonly suitability: FundSuitabilityService,
    private readonly importer: FundImportService,
    private readonly analytics: FundAnalyticsService,
  ) {}

  @Get() findAll(@Query() query: FundQueryDto) { return this.funds.findFiltered(query); }

  @Get('filter-options') filterOptions() { return this.funds.listFilterOptions(); }

  @Get('screener') screen(@Query() query: FundQueryDto) { return this.screener.screen(query); }

  @Post('screener/save')
  saveScreen(@Body() dto: SaveFundScreenDto, @CurrentUser() user: AuthenticatedUser) {
    return this.screener.saveScreen(dto.name, dto.filters ?? {}, user.userId);
  }

  @Get('screener/saved') listSavedScreens() { return this.screener.listScreens(); }

  @Delete('screener/saved/:screenId')
  deleteSavedScreen(@Param('screenId') screenId: string) { return this.screener.deleteScreen(screenId); }

  @Post('compare') compare(@Body() dto: CompareFundsDto) { return this.comparison.compare(dto.fundIds); }

  @Get('suitability/:householdId')
  suitabilityFor(@Param('householdId') householdId: string) { return this.suitability.suitableFundsForHousehold(householdId); }

  @Post('import') import(@Body() dto: ImportFundsDto) { return this.importer.importCsv(dto.csv, dto.sourceLabel); }

  // "Fund → Household Impact": cost/risk/volatility/liquidity delta of
  // switching a household's holding from Fund A to Fund B (Part 6).
  @Post('impact')
  impact(@Body() dto: FundImpactDto) {
    return this.analytics.compareFundSwitchImpact(dto.householdId, dto.fundAId, dto.fundBId, dto.switchAmount);
  }

  @Get(':id') findOne(@Param('id') id: string) { return this.funds.findOneOrFail(id); }

  @Post() create(@Body() dto: CreateFundDto) { return this.funds.create(dto); }

  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateFundDto) { return this.funds.update(id, dto); }

  @Delete(':id') @Roles(Role.ADMIN) remove(@Param('id') id: string) { return this.funds.remove(id); }
}
