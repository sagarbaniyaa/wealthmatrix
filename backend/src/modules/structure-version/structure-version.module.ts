import { Module } from '@nestjs/common';
import { StructureVersionService } from './structure-version.service';
import { StructureVersionController } from './structure-version.controller';
import { HouseholdModule } from '../household/household.module';

@Module({ imports: [HouseholdModule], providers: [StructureVersionService], controllers: [StructureVersionController], exports: [StructureVersionService] })
export class StructureVersionModule {}
