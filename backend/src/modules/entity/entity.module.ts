import { Module } from '@nestjs/common';
import { EntityService } from './entity.service';
import { EntityController } from './entity.controller';
import { EntityStructureModule } from '../../services/entity-structure/entity-structure.module';
import { HouseholdModule } from '../household/household.module';

@Module({
  imports: [EntityStructureModule, HouseholdModule],
  providers: [EntityService],
  controllers: [EntityController],
  exports: [EntityService],
})
export class EntityModule {}
