import { Injectable, NotFoundException } from '@nestjs/common';
import { In } from 'typeorm';
import { TenantContext } from '../../common/database/tenant-context';
import { AccountType, TaxWrapper, TransactionType } from '../../common/enums/domain.enums';
import {
  CgtAnalysisEntity, CgtHoldingDetail, PerPersonCgtPosition, CgtRecommendation,
  HouseholdEntity, HouseholdMemberEntity, PersonEntity, FirmEntity,
  AccountEntity, HoldingEntity, AssetEntity, WealthTransaction, IncomeEntity,
} from '../../database/entities';
import { FXConversionService } from '../fx-conversion/fx-conversion.service';
import { CGT_ANNUAL_EXEMPT_AMOUNT, CGT_BASIC_RATE, CGT_HIGHER_RATE, HIGHER_RATE_THRESHOLD_ANNUAL_INCOME } from './cgt-rates.constants';

const CGT_EXEMPT_WRAPPERS = new Set([TaxWrapper.ISA, TaxWrapper.SIPP]);
const OUT_OF_SCOPE_WRAPPERS = new Set([TaxWrapper.ONSHORE_BOND, TaxWrapper.OFFSHORE_BOND]);

export interface CgtComputeResult {
  asOfDate: string;
  perPerson: PerPersonCgtPosition[];
  recommendations: CgtRecommendation[];
  gaps: string[];
}

/**
 * Analyses a household's PERSONAL (not entity-held — see migration 015)
 * GIA-type holdings for unrealised capital gains, and turns that into
 * concrete, deterministic suggestions: what's cheapest to sell, what
 * already carries no CGT, what to avoid disturbing, and how much could
 * be realised this tax year within the unused annual exempt amount.
 *
 * Nothing here is AI-generated — it's arithmetic over real holdings/
 * transactions plus a small table of current UK CGT constants (see
 * cgt-rates.constants.ts). The one thing it deliberately does NOT do is
 * pick a single CGT rate per person: without a full income-tax
 * computation, basic-vs-higher-rate status is a guess, so both rates
 * are always shown, with the likelier one only labelled, never chosen
 * for the adviser.
 */
@Injectable()
export class CgtIntelligenceService {
  constructor(private readonly fx: FXConversionService) {}

  private get repo() {
    return TenantContext.getManager().getRepository(CgtAnalysisEntity);
  }

  async listForHousehold(householdId: string): Promise<CgtAnalysisEntity[]> {
    return this.repo.find({ where: { householdId } as any, order: { createdAt: 'DESC' } as any });
  }

  async findOneOrFail(id: string): Promise<CgtAnalysisEntity> {
    const row = await this.repo.findOne({ where: { id } as any });
    if (!row) throw new NotFoundException(`CGT analysis ${id} not found`);
    return row;
  }

  async remove(id: string): Promise<void> {
    const row = await this.findOneOrFail(id);
    await this.repo.remove(row);
  }

  async compute(householdId: string, asOfDate?: string): Promise<CgtComputeResult> {
    const manager = TenantContext.getManager();
    const date = asOfDate ?? new Date().toISOString().slice(0, 10);
    const gaps: string[] = [];

    const household = await manager.getRepository(HouseholdEntity).findOne({ where: { id: householdId } as any });
    if (!household) throw new NotFoundException(`Household ${householdId} not found`);
    const firm = await manager.getRepository(FirmEntity).findOne({ where: { id: household.firmId } as any });
    if (!firm?.baseCurrencyId) throw new NotFoundException(`Firm ${household.firmId} has no base_currency_id configured`);
    const baseCurrencyId = firm.baseCurrencyId;

    const members = await manager.getRepository(HouseholdMemberEntity).find({ where: { householdId } as any });
    if (members.length === 0) gaps.push('This household has no members recorded — nothing to analyse.');

    const perPerson: PerPersonCgtPosition[] = [];
    const recommendations: CgtRecommendation[] = [];

    for (const member of members) {
      const person = await manager.getRepository(PersonEntity).findOne({ where: { id: member.personId } as any });
      if (!person) continue;

      const accounts = await manager.getRepository(AccountEntity).find({
        where: { ownerPersonId: person.id, accountType: AccountType.INVESTMENT } as any,
      });

      const holdingDetails: CgtHoldingDetail[] = [];
      let totalGains = 0;
      let totalLosses = 0;

      for (const account of accounts) {
        if (!account.taxWrapper) {
          gaps.push(`${person.firstName} ${person.lastName}'s account with ${account.provider ?? 'an unnamed provider'} has no tax wrapper set — excluded from CGT analysis. Set it on the account to include it.`);
          continue;
        }
        if (OUT_OF_SCOPE_WRAPPERS.has(account.taxWrapper)) {
          gaps.push(`${person.firstName} ${person.lastName}'s ${account.taxWrapper} with ${account.provider ?? 'its provider'} is taxed on chargeable-event gains, not CGT — out of scope for this engine.`);
          continue;
        }

        const holdings = await manager.getRepository(HoldingEntity).find({
          where: { accountId: account.id } as any, order: { asOfDate: 'DESC' } as any,
        });
        // Latest holding row per asset only.
        const latestByAsset = new Map<string, HoldingEntity>();
        for (const h of holdings) if (!latestByAsset.has(h.assetId)) latestByAsset.set(h.assetId, h);

        for (const holding of latestByAsset.values()) {
          const asset = await manager.getRepository(AssetEntity).findOne({ where: { id: holding.assetId } as any });
          const marketValueBase = holding.marketValue * (await this.fx.getRate(holding.currencyId, baseCurrencyId, holding.asOfDate));

          if (CGT_EXEMPT_WRAPPERS.has(account.taxWrapper)) {
            holdingDetails.push({
              accountId: account.id, accountProvider: account.provider, assetId: holding.assetId,
              assetName: asset?.name ?? 'Unknown asset', taxWrapper: account.taxWrapper,
              marketValue: marketValueBase, costBasis: null, gain: null,
              dataQualityNote: `${account.taxWrapper} is CGT-exempt.`,
            });
            continue;
          }

          const { costBasis, note } = await this.computeCostBasis(account.id, holding.assetId, holding.quantity, baseCurrencyId);
          const gain = costBasis !== null ? marketValueBase - costBasis : null;
          if (gain !== null) {
            if (gain >= 0) totalGains += gain; else totalLosses += Math.abs(gain);
          }
          holdingDetails.push({
            accountId: account.id, accountProvider: account.provider, assetId: holding.assetId,
            assetName: asset?.name ?? 'Unknown asset', taxWrapper: account.taxWrapper,
            marketValue: marketValueBase, costBasis, gain, dataQualityNote: note,
          });
        }
      }

      const netGain = totalGains - totalLosses;
      const taxableGain = Math.max(0, netGain - CGT_ANNUAL_EXEMPT_AMOUNT);
      const annualIncome = await this.estimateAnnualIncome(person.id);
      const likelyBand: PerPersonCgtPosition['likelyBand'] = annualIncome === null ? 'unknown' : annualIncome >= HIGHER_RATE_THRESHOLD_ANNUAL_INCOME ? 'higher' : 'basic';

      const position: PerPersonCgtPosition = {
        personId: person.id,
        personName: `${person.firstName} ${person.lastName}`,
        annualExemptAmount: CGT_ANNUAL_EXEMPT_AMOUNT,
        totalGains, totalLosses, netGain,
        remainingAllowance: Math.max(0, CGT_ANNUAL_EXEMPT_AMOUNT - Math.max(0, netGain)),
        estimatedTaxIfRealisedNow: { basicRate: taxableGain * CGT_BASIC_RATE, higherRate: taxableGain * CGT_HIGHER_RATE },
        likelyBand,
        holdings: holdingDetails,
      };
      perPerson.push(position);

      recommendations.push(...this.buildRecommendations(position));
    }

    return { asOfDate: date, perPerson, recommendations, gaps };
  }

  async create(householdId: string, createdBy: string): Promise<CgtAnalysisEntity> {
    const result = await this.compute(householdId);
    const row = this.repo.create({
      firmId: TenantContext.getFirmId(), householdId,
      asOfDate: result.asOfDate, perPerson: result.perPerson, recommendations: result.recommendations, gaps: result.gaps,
      createdBy,
    });
    return this.repo.save(row);
  }

  /** UK Section 104 pooling — a chronological running weighted-average cost. Same-day/30-day "bed and breakfast" matching is NOT implemented (see migration 015). */
  private async computeCostBasis(accountId: string, assetId: string, currentQuantity: number | null, baseCurrencyId: string): Promise<{ costBasis: number | null; note: string | null }> {
    const manager = TenantContext.getManager();
    const txns = await manager.getRepository(WealthTransaction).find({
      where: { accountId, assetId, transactionType: In([TransactionType.BUY, TransactionType.SELL]) } as any,
      order: { transactionDate: 'ASC' } as any,
    });

    if (txns.length === 0) {
      return { costBasis: null, note: 'No buy/sell transaction history found — cost basis unknown, gain cannot be computed.' };
    }

    let poolQty = 0;
    let poolCost = 0;
    for (const txn of txns) {
      const amountBase = txn.amount * (await this.fx.getRate(txn.currencyId, baseCurrencyId, txn.transactionDate));
      if (txn.transactionType === TransactionType.BUY) {
        poolQty += Number(txn.quantity ?? 0);
        poolCost += amountBase;
      } else if (txn.transactionType === TransactionType.SELL && poolQty > 0) {
        const avgCost = poolCost / poolQty;
        const soldQty = Math.min(Number(txn.quantity ?? 0), poolQty);
        poolCost -= avgCost * soldQty;
        poolQty -= soldQty;
      }
    }

    let note: string | null = null;
    if (currentQuantity !== null && Math.abs(poolQty - Number(currentQuantity)) > 0.0001) {
      note = `Transaction history (${poolQty.toFixed(4)} units) doesn't match the current holding quantity (${Number(currentQuantity).toFixed(4)}) — cost basis may be incomplete.`;
    }
    return { costBasis: poolCost, note };
  }

  /** Best-effort only — see cgt-rates.constants.ts. */
  private async estimateAnnualIncome(personId: string): Promise<number | null> {
    const manager = TenantContext.getManager();
    const incomes = await manager.getRepository(IncomeEntity).find({ where: { personId } as any });
    if (incomes.length === 0) return null;
    const FREQUENCY_MULTIPLIER: Record<string, number> = { annual: 1, monthly: 12, quarterly: 4, one_off: 0 };
    return incomes.reduce((sum, i) => sum + Number(i.amount) * (FREQUENCY_MULTIPLIER[i.frequency] ?? 1), 0);
  }

  private buildRecommendations(position: PerPersonCgtPosition): CgtRecommendation[] {
    const recs: CgtRecommendation[] = [];
    const cgtApplicable = position.holdings.filter((h) => h.gain !== null);

    if (cgtApplicable.length === 0) {
      return recs;
    }

    const zeroCgt = position.holdings.filter((h) => h.taxWrapper && CGT_EXEMPT_WRAPPERS.has(h.taxWrapper as TaxWrapper));
    if (zeroCgt.length > 0) {
      recs.push({
        category: 'zero_cgt', personId: position.personId,
        title: `${zeroCgt.length} holding(s) already carry no CGT`,
        detail: `Held in an ISA or SIPP: ${zeroCgt.map((h) => h.assetName).join(', ')}. Selling these never creates a CGT liability.`,
      });
    }

    const losses = cgtApplicable.filter((h) => (h.gain ?? 0) < 0).sort((a, b) => (a.gain ?? 0) - (b.gain ?? 0));
    if (losses.length > 0) {
      recs.push({
        category: 'low_cgt', personId: position.personId, accountId: losses[0].accountId, assetId: losses[0].assetId,
        title: `Selling "${losses[0].assetName}" realises a loss, which can offset gains elsewhere`,
        detail: `Unrealised loss of ${Math.abs(losses[0].gain ?? 0).toFixed(2)}. Realising this loss in the same tax year as a gain reduces the net taxable gain.`,
      });
    }

    const smallGains = cgtApplicable.filter((h) => (h.gain ?? 0) > 0).sort((a, b) => (a.gain ?? 0) - (b.gain ?? 0));
    if (smallGains.length > 0) {
      recs.push({
        category: 'best_to_sell', personId: position.personId, accountId: smallGains[0].accountId, assetId: smallGains[0].assetId,
        title: `"${smallGains[0].assetName}" carries the smallest gain relative to value`,
        detail: `Unrealised gain of ${(smallGains[0].gain ?? 0).toFixed(2)} on a market value of ${smallGains[0].marketValue.toFixed(2)} — the cheapest holding to sell if raising cash is needed.`,
      });
    }

    const largeGains = [...cgtApplicable].sort((a, b) => (b.gain ?? 0) - (a.gain ?? 0));
    if (largeGains.length > 0 && (largeGains[0].gain ?? 0) > 0) {
      recs.push({
        category: 'avoid_selling', personId: position.personId, accountId: largeGains[0].accountId, assetId: largeGains[0].assetId,
        title: `"${largeGains[0].assetName}" carries the largest embedded gain`,
        detail: `Unrealised gain of ${(largeGains[0].gain ?? 0).toFixed(2)}. Selling this alone could exceed the remaining annual exempt amount (${position.remainingAllowance.toFixed(2)}) and trigger CGT at ${(CGT_BASIC_RATE * 100).toFixed(0)}–${(CGT_HIGHER_RATE * 100).toFixed(0)}%.`,
      });
    }

    if (position.remainingAllowance > 0) {
      recs.push({
        category: 'withdrawal_strategy', personId: position.personId,
        title: `${position.remainingAllowance.toFixed(2)} of this year's CGT allowance is unused`,
        detail: `Realising gains up to ${position.remainingAllowance.toFixed(2)} this tax year costs no CGT — a "use it or lose it" allowance that doesn't carry forward. Above that, gains are taxed at ${(CGT_BASIC_RATE * 100).toFixed(0)}% (basic rate) or ${(CGT_HIGHER_RATE * 100).toFixed(0)}% (higher rate)${position.likelyBand !== 'unknown' ? ` — likely ${position.likelyBand} rate based on recorded income` : ''}.`,
      });
    }

    return recs;
  }
}
