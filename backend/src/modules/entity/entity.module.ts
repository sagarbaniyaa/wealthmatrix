import { Module } from '@nestjs/common';
import { EntityService } from './entity.service';
import { EntityController } from './entity.controller';
import { EntityStructureModule } from '../../services/entity-structure/entity-structure.module';

@Module({
  imports: [EntityStructureModule],
  providers: [EntityService],
  controllers: [EntityController],
  exports: [EntityService],
})
export class EntityModule {}
