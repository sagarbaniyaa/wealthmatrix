import { Module } from '@nestjs/common';
import { HoldingService } from './holding.service';
import { HoldingController } from './holding.controller';

@Module({ providers: [HoldingService], controllers: [HoldingController], exports: [HoldingService] })
export class HoldingModule {}
