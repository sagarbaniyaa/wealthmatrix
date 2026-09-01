import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';

import { DatabaseModule } from './database/database.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TenantTransactionInterceptor } from './common/database/tenant-transaction.interceptor';

import { AuthModule } from './auth/auth.module';
import { FirmModule } from './modules/firm/firm.module';
import { CurrencyModule } from './modules/currency/currency.module';
import { ExchangeRateModule } from './modules/exchange-rate/exchange-rate.module';
import { PersonModule } from './modules/person/person.module';
import { HouseholdModule } from './modules/household/household.module';
import { HouseholdMemberModule } from './modules/household-member/household-member.module';
import { AdviserHouseholdAssignmentModule } from './modules/adviser-household-assignment/adviser-household-assignment.module';
import { EntityModule } from './modules/entity/entity.module';
import { EntityOwnershipModule } from './modules/entity-ownership/entity-ownership.module';
import { AccountModule } from './modules/account/account.module';
import { AssetModule } from './modules/asset/asset.module';
import { HoldingModule } from './modules/holding/holding.module';
import { TransactionModule } from './modules/transaction/transaction.module';
import { ScenarioModule } from './modules/scenario/scenario.module';
import { RiskExposureModule } from './modules/risk-exposure/risk-exposure.module';
import { ComplianceLogModule } from './modules/compliance-log/compliance-log.module';
import { StructureVersionModule } from './modules/structure-version/structure-version.module';
import { IncomeModule } from './modules/income/income.module';
import { ClientNoteModule } from './modules/client-note/client-note.module';
import { AppUserModule } from './modules/app-user/app-user.module';
import { FundModule } from './modules/fund/fund.module';
import { FundPerformanceModule } from './modules/fund-performance/fund-performance.module';
import { FundHoldingsModule } from './modules/fund-holdings/fund-holdings.module';
import { FundAllocationModule } from './modules/fund-allocation/fund-allocation.module';
import { ProviderModule } from './modules/provider/provider.module';
import { ClientDocumentModule } from './modules/client-document/client-document.module';
import { LoaTemplateModule } from './modules/loa-template/loa-template.module';
import { FactFindModule } from './modules/fact-find/fact-find.module';
import { ReportTemplateModule } from './modules/report-template/report-template.module';

import { WealthConsolidationModule } from './services/wealth-consolidation/wealth-consolidation.module';
import { EntityStructureModule } from './services/entity-structure/entity-structure.module';
import { ScenarioEngineModule } from './services/scenario-engine/scenario-engine.module';
import { AuditLogModule } from './services/audit-log/audit-log.module';
import { FXConversionModule } from './services/fx-conversion/fx-conversion.module';
import { ProviderHubModule } from './services/provider-hub/provider-hub.module';
import { ReportBuilderModule } from './services/report-builder/report-builder.module';
import { ChargeProjectionModule } from './services/charge-projection/charge-projection.module';

import { AiModule } from './ai/ai.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    DatabaseModule,

    AuthModule,

    FirmModule,
    CurrencyModule,
    ExchangeRateModule,
    PersonModule,
    HouseholdModule,
    HouseholdMemberModule,
    AdviserHouseholdAssignmentModule,
    EntityModule,
    EntityOwnershipModule,
    AccountModule,
    AssetModule,
    HoldingModule,
    TransactionModule,
    ScenarioModule,
    RiskExposureModule,
    ComplianceLogModule,
    StructureVersionModule,
    IncomeModule,
    ClientNoteModule,
    AppUserModule,
    FundModule,
    FundPerformanceModule,
    FundHoldingsModule,
    FundAllocationModule,
    ProviderModule,
    ClientDocumentModule,
    LoaTemplateModule,
    FactFindModule,
    ReportTemplateModule,

    WealthConsolidationModule,
    EntityStructureModule,
    ScenarioEngineModule,
    AuditLogModule,
    FXConversionModule,
    ProviderHubModule,
    ReportBuilderModule,
    ChargeProjectionModule,

    AiModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    // Order matters: JwtAuthGuard (route-level, via @UseGuards) populates
    // req.user BEFORE this global interceptor runs — Nest always resolves
    // guards ahead of interceptors in the request pipeline.
    { provide: APP_INTERCEPTOR, useClass: TenantTransactionInterceptor },
  ],
})
export class AppModule {}
