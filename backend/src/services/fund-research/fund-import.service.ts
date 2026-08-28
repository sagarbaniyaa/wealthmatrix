import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { TenantContext } from '../../common/database/tenant-context';
import { FundEntity, CurrencyEntity } from '../../database/entities';

const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;
const SEDOL_RE = /^[A-Z0-9]{7}$/;
const ASSET_CLASSES = new Set(['equity', 'fixed_income', 'mixed_asset', 'money_market', 'property', 'alternative']);

export interface FundImportRowError { row: number; isin: string | null; reason: string }
export interface FundImportResult {
  totalRows: number;
  imported: number;
  updated: number;
  skipped: number;
  errors: FundImportRowError[];
}

/**
 * CSV ingestion for the fund universe. Designed for the real ~3,700 UK
 * fund case (OEICs/unit trusts/ACS/investment trusts) once you have an
 * actual data file from a licensed provider (Morningstar, FE fundinfo,
 * Lipper, etc.) — nothing here fabricates fund data; it only validates
 * and stores what it's given.
 *
 * Expected header row (case-insensitive, order doesn't matter):
 *   name,isin,sedol,sector,assetClass,ocf,yieldPct,riskRating,
 *   volatilityPct,maxDrawdownPct,manager,managerTenureYears,esgScore,
 *   currencyCode,inceptionDate,aum,description
 * Only name/isin/sector/assetClass are required; everything else is
 * optional and left null if blank or omitted.
 */
@Injectable()
export class FundImportService {
  private readonly logger = new Logger(FundImportService.name);

  constructor(private readonly config: ConfigService) {}

  async importCsv(csv: string, dataSourceLabel = 'csv'): Promise<FundImportResult> {
    const rows = parseCsv(csv);
    if (rows.length === 0) throw new BadRequestException('CSV has no data rows.');

    const manager = TenantContext.getManager();
    const repo = manager.getRepository(FundEntity);
    const currencies = await manager.getRepository(CurrencyEntity).find();
    const currencyIdByCode = new Map(currencies.map((c) => [c.code.toUpperCase(), c.id]));

    const errors: FundImportRowError[] = [];
    let imported = 0;
    let updated = 0;
    let skipped = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +1 for header, +1 for 1-indexing
      const isin = (row.isin ?? '').trim().toUpperCase();

      const rowErrors: string[] = [];
      if (!row.name?.trim()) rowErrors.push('name is required');
      if (!isin) rowErrors.push('isin is required');
      else if (!ISIN_RE.test(isin)) rowErrors.push(`isin "${isin}" is not a valid ISIN (2 letters + 9 alphanumeric + check digit)`);
      if (row.sedol && !SEDOL_RE.test(row.sedol.trim().toUpperCase())) rowErrors.push(`sedol "${row.sedol}" is not 7 alphanumeric characters`);
      if (!row.sector?.trim()) rowErrors.push('sector is required');
      const assetClass = row.assetClass?.trim().toLowerCase();
      if (!assetClass) rowErrors.push('assetClass is required');
      else if (!ASSET_CLASSES.has(assetClass)) rowErrors.push(`assetClass "${assetClass}" must be one of: ${[...ASSET_CLASSES].join(', ')}`);

      if (rowErrors.length > 0) {
        errors.push({ row: rowNum, isin: isin || null, reason: rowErrors.join('; ') });
        skipped++;
        continue;
      }

      const currencyCode = row.currencyCode?.trim().toUpperCase();
      const currencyId = currencyCode ? currencyIdByCode.get(currencyCode) ?? null : null;
      if (currencyCode && !currencyId) {
        // Not a hard failure — the fund still imports, just without an FX-linked currency.
        this.logger.warn(`Row ${rowNum} (${isin}): currency code "${currencyCode}" not found, leaving currency unset.`);
      }

      const existing = await repo.findOne({ where: { isin } as any });

      const values = {
        firmId: TenantContext.getFirmId(),
        name: row.name!.trim(),
        isin,
        sedol: row.sedol?.trim().toUpperCase() || null,
        sector: row.sector!.trim(),
        assetClass,
        ocf: toNumber(row.ocf),
        yieldPct: toNumber(row.yieldPct),
        riskRating: toInt(row.riskRating),
        volatilityPct: toNumber(row.volatilityPct),
        maxDrawdownPct: toNumber(row.maxDrawdownPct),
        manager: row.manager?.trim() || null,
        managerTenureYears: toNumber(row.managerTenureYears),
        esgScore: toNumber(row.esgScore),
        currencyId,
        inceptionDate: row.inceptionDate?.trim() || null,
        aum: toNumber(row.aum),
        description: row.description?.trim() || null,
        dataSource: dataSourceLabel,
      };

      if (existing) {
        await repo.update(existing.id, values);
        updated++;
      } else {
        await repo.save(repo.create(values));
        imported++;
      }
    }

    return { totalRows: rows.length, imported, updated, skipped, errors };
  }

  /**
   * Wired up for real, but inert without a configured source: there is no
   * licensed UK fund data feed credential in this environment. Set
   * FUND_DATA_SOURCE_URL (+ FUND_DATA_SOURCE_API_KEY if needed) to point
   * this at a real provider's export endpoint and implement the fetch
   * below; until then it just logs and exits so the cron registration
   * itself is real infrastructure, not a fake promise.
   *
   * IMPORTANT when implementing the fetch: importCsv() reads/writes via
   * TenantContext, which only exists inside an HTTP request wrapped by
   * TenantTransactionInterceptor — a cron tick has no such context. A
   * real implementation needs to loop over every firm and, per firm,
   * open its own QueryRunner + `set_config('app.current_firm_id', ...)`
   * and run inside `tenantALS.run({ firmId, userId: null, role: admin,
   * manager }, () => ...)` — same shape as the interceptor, just
   * triggered by the clock instead of a request. Do not call importCsv()
   * directly from here as-is; it will throw immediately.
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async runNightlyUpdate(): Promise<void> {
    const sourceUrl = this.config.get<string>('FUND_DATA_SOURCE_URL');
    if (!sourceUrl) {
      this.logger.log('Nightly fund update skipped — FUND_DATA_SOURCE_URL is not configured.');
      return;
    }
    this.logger.log(`Nightly fund update: fetching ${sourceUrl} — not yet implemented for a specific provider's API shape.`);
    // const csv = await fetch(sourceUrl, { headers: { Authorization: `Bearer ${this.config.get('FUND_DATA_SOURCE_API_KEY')}` } }).then(r => r.text());
    // await this.importCsv(csv, `cron:${sourceUrl}`); // see the tenant-context note above before wiring this up
  }
}

function toNumber(v: string | undefined): number | null {
  if (v === undefined || v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function toInt(v: string | undefined): number | null {
  const n = toNumber(v);
  return n === null ? null : Math.round(n);
}

/** Minimal RFC-4180-ish CSV parser: quoted fields, escaped quotes, CRLF/LF. No external dependency for a controlled import format. */
function parseCsv(text: string): Record<string, string>[] {
  const lines = splitCsvLines(text.trim());
  if (lines.length === 0) return [];
  const header = lines[0].map((h) => toCamelCase(h.trim()));
  return lines.slice(1)
    .filter((cells) => cells.some((c) => c.trim() !== ''))
    .map((cells) => {
      const row: Record<string, string> = {};
      header.forEach((key, i) => { row[key] = cells[i] ?? ''; });
      return row;
    });
}

function splitCsvLines(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { field += c; }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      rows.push(row); row = [];
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

function toCamelCase(header: string): string {
  return header.replace(/[_\s-]+([a-zA-Z0-9])/g, (_, c) => c.toUpperCase()).replace(/^([A-Z])/, (c) => c.toLowerCase());
}
