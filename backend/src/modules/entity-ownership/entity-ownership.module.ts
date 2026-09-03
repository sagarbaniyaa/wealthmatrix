import { Module } from '@nestjs/common';
import { EntityOwnershipService } from './entity-ownership.service';
import { EntityOwnershipController } from './entity-ownership.controller';
import { HouseholdModule } from '../household/household.module';

@Module({
  imports: [HouseholdModule],
  providers: [EntityOwnershipService],
  controllers: [EntityOwnershipController],
  exports: [EntityOwnershipService],
})
export class EntityOwnershipModule {}
