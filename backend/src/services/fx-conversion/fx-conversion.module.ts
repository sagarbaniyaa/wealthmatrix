import { Module } from '@nestjs/common';
import { FXConversionService } from './fx-conversion.service';

@Module({ providers: [FXConversionService], exports: [FXConversionService] })
export class FXConversionModule {}
