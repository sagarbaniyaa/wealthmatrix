import { Module } from '@nestjs/common';
import { LoaTemplateService } from '../../services/provider-hub/loa-template.service';
import { LoaTemplateController } from './loa-template.controller';

@Module({
  providers: [LoaTemplateService],
  controllers: [LoaTemplateController],
  exports: [LoaTemplateService],
})
export class LoaTemplateModule {}
