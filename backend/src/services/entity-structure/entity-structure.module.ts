import { Module } from '@nestjs/common';
import { EntityStructureService } from './entity-structure.service';

@Module({ providers: [EntityStructureService], exports: [EntityStructureService] })
export class EntityStructureModule {}
