import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { AdviserHouseholdAssignmentService } from './adviser-household-assignment.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('adviser-assignments')
export class AdviserHouseholdAssignmentController {
  constructor(private readonly service: AdviserHouseholdAssignmentService) {}

  @Get() @Roles(Role.ADMIN) findAll() { return this.service.findAll(); }

  @Post() @Roles(Role.ADMIN)
  create(@Body() dto: CreateAssignmentDto) { return this.service.create(dto); }

  @Delete(':id') @Roles(Role.ADMIN)
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
