import { Module } from '@nestjs/common';
import { FirmService } from './firm.service';
import { FirmController } from './firm.controller';

@Module({ providers: [FirmService], controllers: [FirmController], exports: [FirmService] })
export class FirmModule {}
