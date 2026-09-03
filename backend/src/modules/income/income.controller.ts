import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { HouseholdService } from '../household/household.service';
import { IncomeService } from './income.service';
import { CreateIncomeDto } from './dto/create-income.dto';
import { UpdateIncomeDto } from './dto/update-income.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

// Closed access-control gap: income is scoped only by person_id (no
// household_id), so nothing previously stopped any adviser or client in
// the firm reading another household's income data — or an unfiltered
// findAll returning every income row in the firm — by knowing or
// guessing a person id. See HouseholdService.ensurePersonAccessible.
@ApiTags('Income')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('income')
export class IncomeController {
  constructor(
    private readonly service: IncomeService,
    private readonly households: HouseholdService,
  ) {}

  @Get() @Roles(Role.ADMIN, Role.ADVISER, Role.CLIENT)
  async findAll(@Query('personId') personId: string | undefined, @CurrentUser() user: AuthenticatedUser) {
    if (!personId && user.role !== Role.ADMIN) throw new BadRequestException('personId is required.');
    if (personId) await this.households.ensurePersonAccessible(personId, user as any);
    return this.service.findAll(personId ? ({ personId } as any) : {});
  }

  @Get(':id') @Roles(Role.ADMIN, Role.ADVISER, Role.CLIENT)
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const income = await this.service.findOneOrFail(id);
    await this.households.ensurePersonAccessible(income.personId, user as any);
    return income;
  }

  @Post() @Roles(Role.ADMIN, Role.ADVISER)
  async create(@Body() dto: CreateIncomeDto, @CurrentUser() user: AuthenticatedUser) {
    await this.households.ensurePersonAccessible(dto.personId, user as any);
    return this.service.create(dto);
  }

  @Patch(':id') @Roles(Role.ADMIN, Role.ADVISER)
  async update(@Param('id') id: string, @Body() dto: UpdateIncomeDto, @CurrentUser() user: AuthenticatedUser) {
    const income = await this.service.findOneOrFail(id);
    await this.households.ensurePersonAccessible(income.personId, user as any);
    return this.service.update(id, dto);
  }

  @Delete(':id') @Roles(Role.ADMIN, Role.ADVISER)
  async remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const income = await this.service.findOneOrFail(id);
    await this.households.ensurePersonAccessible(income.personId, user as any);
    return this.service.remove(id);
  }
}
