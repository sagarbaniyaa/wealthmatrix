import { Module } from '@nestjs/common';
import { ProviderModule } from '../../modules/provider/provider.module';
import { ClientDocumentModule } from '../../modules/client-document/client-document.module';
import { LoaTemplateModule } from '../../modules/loa-template/loa-template.module';
import { HouseholdModule } from '../../modules/household/household.module';
import { WealthConsolidationModule } from '../wealth-consolidation/wealth-consolidation.module';
import { MailerModule } from '../../common/mailer/mailer.module';

import { LoaTokenBuilderService } from './loa-token-builder.service';
import { LoaAutofillService } from './loa-autofill.service';
import { DocumentGeneratorService } from './document-generator.service';
import { ProviderPackService } from './provider-pack.service';
import { ProviderSendService } from './provider-send.service';

import { ProviderPackController } from '../../modules/provider-pack/provider-pack.controller';
import { ComplianceProviderActionController } from '../../modules/provider-pack/compliance-provider-action.controller';

@Module({
  imports: [ProviderModule, ClientDocumentModule, LoaTemplateModule, HouseholdModule, WealthConsolidationModule, MailerModule],
  providers: [LoaTokenBuilderService, LoaAutofillService, DocumentGeneratorService, ProviderPackService, ProviderSendService],
  controllers: [ProviderPackController, ComplianceProviderActionController],
  exports: [ProviderSendService, ProviderPackService],
})
export class ProviderHubModule {}
