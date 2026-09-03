import { Module } from '@nestjs/common';
import { HouseholdMemberService } from './household-member.service';
import { HouseholdMemberController } from './household-member.controller';
import { HouseholdModule } from '../household/household.module';

@Module({ imports: [HouseholdModule], providers: [HouseholdMemberService], controllers: [HouseholdMemberController], exports: [HouseholdMemberService] })
export class HouseholdMemberModule {}
