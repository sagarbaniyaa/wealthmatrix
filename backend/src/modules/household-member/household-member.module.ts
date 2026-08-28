import { Module } from '@nestjs/common';
import { HouseholdMemberService } from './household-member.service';
import { HouseholdMemberController } from './household-member.controller';

@Module({ providers: [HouseholdMemberService], controllers: [HouseholdMemberController], exports: [HouseholdMemberService] })
export class HouseholdMemberModule {}
