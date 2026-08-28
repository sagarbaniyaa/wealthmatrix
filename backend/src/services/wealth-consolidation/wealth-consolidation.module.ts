import { Module } from '@nestjs/common';
import { WealthConsolidationService } from './wealth-consolidation.service';
import { FXConversionModule } from '../fx-conversion/fx-conversion.module';

@Module({
  imports: [FXConversionModule],
  providers: [WealthConsolidationService],
  exports: [WealthConsolidationService],
})
export class WealthConsolidationModule {}
