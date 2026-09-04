import { Injectable, NotFoundException } from '@nestjs/common';
import { In } from 'typeorm';
import { TenantContext } from '../../common/database/tenant-context';
import { ComplianceSeverity } from '../../common/enums/domain.enums';
import {
  PersonEntity, HouseholdMemberEntity, AccountEntity, HoldingEntity, WealthTransaction,
  IncomeEntity, EntityOwnershipEntity, FactFindEntity, ClientNoteEntity, ClientCallLogEntity,
} from '../../database/entities';
import { ComplianceLogService } from '../../modules/compliance-log/compliance-log.service';

export interface PersonDataExport {
  exportedAt: string;
  person: PersonEntity;
  householdMemberships: HouseholdMemberEntity[];
  accounts: AccountEntity[];
  holdings: HoldingEntity[];
  transactions: WealthTransaction[];
  income: IncomeEntity[];
  entityOwnershipStakes: EntityOwnershipEntity[];
  factFinds: FactFindEntity[];
  clientNotes: ClientNoteEntity[];
  callLogs: ClientCallLogEntity[];
}

/**
 * A UK GDPR subject access request (export) and right-to-erasure
 * (anonymisation) tool for a single person's record — the one thing
 * this platform genuinely had no answer for until now: someone asking
 * "what do you hold on me" or "delete my data" had to be handled by
 * hand, DB access required.
 *
 * Erasure is deliberately anonymisation, not deletion: a regulated UK
 * financial-advice firm has its own statutory record-keeping duties
 * (FCA rules generally require retaining client records for several
 * years after a relationship ends) that GDPR's erasure right does not
 * override — Article 17(3)(b) explicitly carves out "compliance with a
 * legal obligation". Hard-deleting accounts/holdings/transactions would
 * both break that obligation and cascade-destroy other people's shared
 * records (a joint account, a household's fact find). What this DOES
 * remove: every directly-identifying field on the person record itself
 * (name, DOB, contact details, address, NI number) — the financial
 * activity stays, attached to an anonymised record, same as how a bank
 * handles an erasure request against records it's still required to
 * keep.
 */
@Injectable()
export class GdprService {
  constructor(private readonly complianceLog: ComplianceLogService) {}

  async exportPersonData(personId: string): Promise<PersonDataExport> {
    const manager = TenantContext.getManager();

    const person = await manager.getRepository(PersonEntity).findOne({ where: { id: personId } as any });
    if (!person) throw new NotFoundException(`Person ${personId} not found`);

    const householdMemberships = await manager.getRepository(HouseholdMemberEntity).find({ where: { personId } as any });
    const householdIds = householdMemberships.map((m) => m.householdId);

    const accounts = await manager.getRepository(AccountEntity).find({ where: { ownerPersonId: personId } as any });
    const accountIds = accounts.map((a) => a.id);

    const [holdings, transactions] = accountIds.length
      ? await Promise.all([
          manager.getRepository(HoldingEntity).find({ where: { accountId: In(accountIds) } as any }),
          manager.getRepository(WealthTransaction).find({ where: { accountId: In(accountIds) } as any }),
        ])
      : [[], []];

    const income = await manager.getRepository(IncomeEntity).find({ where: { personId } as any });
    const entityOwnershipStakes = await manager.getRepository(EntityOwnershipEntity).find({ where: { ownerPersonId: personId } as any });

    const [factFinds, clientNotes] = householdIds.length
      ? await Promise.all([
          manager.getRepository(FactFindEntity).find({ where: { householdId: In(householdIds) } as any }),
          manager.getRepository(ClientNoteEntity).find({ where: { householdId: In(householdIds) } as any }),
        ])
      : [[], []];

    const callLogs = await manager.getRepository(ClientCallLogEntity).find({ where: { clientPersonId: personId } as any });

    return {
      exportedAt: new Date().toISOString(),
      person, householdMemberships, accounts, holdings, transactions, income,
      entityOwnershipStakes, factFinds, clientNotes, callLogs,
    };
  }

  async erasePersonData(personId: string, erasedBy: string): Promise<void> {
    const manager = TenantContext.getManager();

    const person = await manager.getRepository(PersonEntity).findOne({ where: { id: personId } as any });
    if (!person) throw new NotFoundException(`Person ${personId} not found`);

    await manager.getRepository(PersonEntity).update(personId, {
      firstName: 'Erased', lastName: 'Client', email: null, phone: null, dateOfBirth: null,
      addressLine1: null, addressLine2: null, city: null, postalCode: null, country: null,
      niNumber: null, sourceOfWealth: null, taxResidency: null, domicile: null,
    });

    // Best-effort — logged against whichever household this person is a
    // member of, so the erasure shows up where an adviser would actually
    // see it. A person with no household membership at all still gets
    // erased; there's just nowhere household-scoped to log it.
    const membership = await manager.getRepository(HouseholdMemberEntity).findOne({ where: { personId } as any });
    if (membership) {
      await this.complianceLog.create({
        householdId: membership.householdId,
        entityId: null,
        severity: ComplianceSeverity.WARNING,
        ruleCode: 'GDPR_ERASURE',
        message: `Personal data for this person was erased (GDPR right-to-erasure request), by ${erasedBy}. ` +
          `Name, date of birth, contact details, address, and NI number were removed. Financial records ` +
          `(accounts, holdings, transactions, income) are retained under statutory record-keeping ` +
          `obligations and are no longer attributable to identifying information.`,
        detectedAt: new Date(),
        metadata: { personId, erasedBy },
      } as any);
    }
  }
}
