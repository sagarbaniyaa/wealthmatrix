import { Module } from '@nestjs/common';
import { PersonService } from './person.service';
import { PersonController } from './person.controller';
import { HouseholdModule } from '../household/household.module';
import { GdprModule } from '../../services/gdpr/gdpr.module';

@Module({ imports: [HouseholdModule, GdprModule], providers: [PersonService], controllers: [PersonController], exports: [PersonService] })
export class PersonModule {}
