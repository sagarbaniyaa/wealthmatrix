import { Module } from '@nestjs/common';
import { AdviserHouseholdAssignmentService } from './adviser-household-assignment.service';
import { AdviserHouseholdAssignmentController } from './adviser-household-assignment.controller';

@Module({
  providers: [AdviserHouseholdAssignmentService],
  controllers: [AdviserHouseholdAssignmentController],
  exports: [AdviserHouseholdAssignmentService],
})
export class AdviserHouseholdAssignmentModule {}
