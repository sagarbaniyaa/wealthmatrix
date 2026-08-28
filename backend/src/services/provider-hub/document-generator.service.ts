import { Injectable, NotFoundException } from '@nestjs/common';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { TenantContext } from '../../common/database/tenant-context';
import {
  HouseholdEntity, HouseholdMemberEntity, PersonEntity, IncomeEntity,
  AccountEntity, HoldingEntity, AppUserEntity, FirmEntity,
} from '../../database/entities';
import { WealthConsolidationService } from '../wealth-consolidation/wealth-consolidation.service';

interface Section { heading: string; lines: string[] }

/**
 * Generates the three provider-pack documents that don't need an adviser
 * upload because we already hold the data: fact_find, policy_summary,
 * adviser_details. Plain, single-column text pages via pdf-lib — not a
 * polished document design, but a genuine, accurate summary pulled live
 * from the platform's own data rather than a static placeholder file.
 * Long households/many holdings get truncated to what fits a handful of
 * pages rather than paginating indefinitely — see README Known gaps.
 */
@Injectable()
export class DocumentGeneratorService {
  constructor(private readonly wealthConsolidation: WealthConsolidationService) {}

  async generateFactFind(householdId: string): Promise<Buffer> {
    const manager = TenantContext.getManager();
    const household = await manager.getRepository(HouseholdEntity).findOne({ where: { id: householdId } as any });
    if (!household) throw new NotFoundException(`Household ${householdId} not found`);

    const members = await manager.getRepository(HouseholdMemberEntity).find({ where: { householdId } as any });
    const persons = await Promise.all(members.map((m) => manager.getRepository(PersonEntity).findOne({ where: { id: m.personId } as any })));
    const validPersons = persons.filter((p): p is PersonEntity => !!p);

    const sections: Section[] = [{ heading: 'Household', lines: [`Name: ${household.name}`] }];

    for (const person of validPersons) {
      const income = await manager.getRepository(IncomeEntity).find({ where: { personId: person.id } as any });
      sections.push({
        heading: `Member: ${person.firstName} ${person.lastName}`,
        lines: [
          `Date of birth: ${person.dateOfBirth ?? 'not recorded'}`,
          `Address: ${[person.addressLine1, person.addressLine2, person.city, person.postalCode, person.country].filter(Boolean).join(', ') || 'not recorded'}`,
          `Email: ${person.email ?? 'not recorded'}    Phone: ${person.phone ?? 'not recorded'}`,
          `NI number: ${person.niNumber ?? 'not recorded'}`,
          `KYC status: ${person.kycStatus}    Risk tolerance: ${person.riskTolerance ?? 'not recorded'}`,
          `Source of wealth: ${person.sourceOfWealth ?? 'not recorded'}`,
          '',
          'Income:',
          ...(income.length === 0 ? ['  (none recorded)'] : income.map((i) => `  ${i.incomeType} — ${Number(i.amount).toLocaleString('en-GB')} (${i.frequency ?? 'annual'})`)),
        ],
      });
    }

    try {
      const netWorth = await this.wealthConsolidation.getHouseholdNetWorth(householdId);
      sections.push({
        heading: 'Net worth summary',
        lines: [
          `Personal net worth: ${netWorth.personalNetWorth.toLocaleString('en-GB')} ${netWorth.baseCurrencyCode}`,
          `Entity-attributed net worth: ${netWorth.entityAttributedNetWorth.toLocaleString('en-GB')} ${netWorth.baseCurrencyCode}`,
          `Total net worth: ${netWorth.totalNetWorth.toLocaleString('en-GB')} ${netWorth.baseCurrencyCode}`,
        ],
      });
    } catch {
      sections.push({ heading: 'Net worth summary', lines: ['Not available.'] });
    }

    return drawDocument('Client Fact Find', sections);
  }

  async generatePolicySummary(householdId: string): Promise<Buffer> {
    const manager = TenantContext.getManager();
    const members = await manager.getRepository(HouseholdMemberEntity).find({ where: { householdId } as any });
    const personIds = members.map((m) => m.personId);

    const sections: Section[] = [];
    if (personIds.length === 0) {
      sections.push({ heading: 'Policies', lines: ['No household members recorded.'] });
      return drawDocument('Policy Summary', sections);
    }

    const accounts = await manager.getRepository(AccountEntity)
      .createQueryBuilder('a').where('a.owner_person_id IN (:...ids)', { ids: personIds }).getMany();

    if (accounts.length === 0) {
      sections.push({ heading: 'Policies', lines: ['No accounts/policies recorded for this household.'] });
      return drawDocument('Policy Summary', sections);
    }

    for (const account of accounts) {
      const holdings = await manager.getRepository(HoldingEntity)
        .createQueryBuilder('h').where('h.account_id = :id', { id: account.id }).orderBy('h.as_of_date', 'DESC').getMany();
      const latestValue = holdings.length > 0 ? Number(holdings[0].marketValue) : null;
      sections.push({
        heading: `${account.accountType.toUpperCase()} — ${account.provider ?? 'provider not recorded'}`,
        lines: [
          `Policy number: ${account.policyNumber ?? 'not recorded'}`,
          `Latest known value: ${latestValue !== null ? latestValue.toLocaleString('en-GB') : 'not recorded'}`,
        ],
      });
    }

    return drawDocument('Policy Summary', sections);
  }

  async generateAdviserDetails(adviserId: string): Promise<Buffer> {
    const manager = TenantContext.getManager();
    const adviser = await manager.getRepository(AppUserEntity).findOne({ where: { id: adviserId } as any });
    if (!adviser) throw new NotFoundException(`Adviser ${adviserId} not found`);
    const firm = await manager.getRepository(FirmEntity).findOne({ where: { id: adviser.firmId } as any });

    const sections: Section[] = [{
      heading: 'Adviser',
      lines: [
        `Name: ${adviser.displayName ?? adviser.email}`,
        `Email: ${adviser.email}`,
        `Phone: ${adviser.phone ?? 'not recorded'}`,
        `Address: ${[adviser.addressLine1, adviser.city, adviser.postalCode].filter(Boolean).join(', ') || 'not recorded'}`,
      ],
    }, {
      heading: 'Firm',
      lines: [
        `Name: ${firm?.name ?? 'not recorded'}`,
        `FCA reference: ${firm?.fcaReference ?? 'not recorded'}`,
      ],
    }];

    return drawDocument('Adviser Details', sections);
  }
}

async function drawDocument(title: string, sections: Section[]): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = [595.28, 841.89]; // A4 points
  const margin = 50;
  const lineHeight = 14;

  let page = pdfDoc.addPage(pageSize);
  let y = pageSize[1] - margin;

  page.drawText(title, { x: margin, y, size: 18, font: boldFont, color: rgb(0.1, 0.1, 0.1) });
  y -= lineHeight * 2;
  page.drawText(`Generated ${new Date().toISOString().slice(0, 10)} — WealthMatrix Enterprise (auto-generated, not a substitute for the source records)`, {
    x: margin, y, size: 8, font, color: rgb(0.5, 0.5, 0.5),
  });
  y -= lineHeight * 2;

  function ensureSpace() {
    if (y < margin + lineHeight) {
      page = pdfDoc.addPage(pageSize);
      y = pageSize[1] - margin;
    }
  }

  for (const section of sections) {
    ensureSpace();
    page.drawText(section.heading, { x: margin, y, size: 12, font: boldFont, color: rgb(0.1, 0.1, 0.1) });
    y -= lineHeight * 1.4;
    for (const line of section.lines) {
      ensureSpace();
      page.drawText(line.slice(0, 100), { x: margin, y, size: 10, font, color: rgb(0.2, 0.2, 0.2) });
      y -= lineHeight;
    }
    y -= lineHeight * 0.6;
  }

  return Buffer.from(await pdfDoc.save());
}
