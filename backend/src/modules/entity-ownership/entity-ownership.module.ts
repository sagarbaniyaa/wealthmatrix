import { Module } from '@nestjs/common';
import { EntityOwnershipService } from './entity-ownership.service';
import { EntityOwnershipController } from './entity-ownership.controller';

@Module({
  providers: [EntityOwnershipService],
  controllers: [EntityOwnershipController],
  exports: [EntityOwnershipService],
})
export class EntityOwnershipModule {}
