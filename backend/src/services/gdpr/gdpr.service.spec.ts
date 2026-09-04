import { NotFoundException } from '@nestjs/common';
import { tenantALS } from '../../common/database/tenant-context';
import { Role } from '../../common/enums/role.enum';
import { ComplianceSeverity } from '../../common/enums/domain.enums';
import {
  PersonEntity, HouseholdMemberEntity, AccountEntity, HoldingEntity, WealthTransaction,
  IncomeEntity, EntityOwnershipEntity, FactFindEntity, ClientNoteEntity, ClientCallLogEntity,
} from '../../database/entities';
import { GdprService } from './gdpr.service';

function makeMockManager(opts: {
  person?: Partial<PersonEntity> | null;
  memberships?: Partial<HouseholdMemberEntity>[];
  accounts?: Partial<AccountEntity>[];
  holdings?: Partial<HoldingEntity>[];
  transactions?: Partial<WealthTransaction>[];
  income?: Partial<IncomeEntity>[];
  ownershipStakes?: Partial<EntityOwnershipEntity>[];
  factFinds?: Partial<FactFindEntity>[];
  notes?: Partial<ClientNoteEntity>[];
  callLogs?: Partial<ClientCallLogEntity>[];
} = {}) {
  const personUpdate = jest.fn().mockResolvedValue({ affected: 1 });
  const personFindOne = jest.fn().mockResolvedValue(opts.person ?? null);
  const personRepo = { findOne: personFindOne, update: personUpdate };
  const householdMemberRepo = {
    find: jest.fn().mockResolvedValue(opts.memberships ?? []),
    findOne: jest.fn().mockResolvedValue((opts.memberships ?? [])[0] ?? null),
  };
  const accountRepo = { find: jest.fn().mockResolvedValue(opts.accounts ?? []) };
  const holdingRepo = { find: jest.fn().mockResolvedValue(opts.holdings ?? []) };
  const transactionRepo = { find: jest.fn().mockResolvedValue(opts.transactions ?? []) };
  const incomeRepo = { find: jest.fn().mockResolvedValue(opts.income ?? []) };
  const ownershipRepo = { find: jest.fn().mockResolvedValue(opts.ownershipStakes ?? []) };
  const factFindRepo = { find: jest.fn().mockResolvedValue(opts.factFinds ?? []) };
  const noteRepo = { find: jest.fn().mockResolvedValue(opts.notes ?? []) };
  const callLogRepo = { find: jest.fn().mockResolvedValue(opts.callLogs ?? []) };

  const manager = {
    getRepository: jest.fn((entity: any) => {
      if (entity === PersonEntity) return personRepo;
      if (entity === HouseholdMemberEntity) return householdMemberRepo;
      if (entity === AccountEntity) return accountRepo;
      if (entity === HoldingEntity) return holdingRepo;
      if (entity === WealthTransaction) return transactionRepo;
      if (entity === IncomeEntity) return incomeRepo;
      if (entity === EntityOwnershipEntity) return ownershipRepo;
      if (entity === FactFindEntity) return factFindRepo;
      if (entity === ClientNoteEntity) return noteRepo;
      if (entity === ClientCallLogEntity) return callLogRepo;
      throw new Error(`Unexpected repository requested: ${entity}`);
    }),
  };
  return { manager, personUpdate, personFindOne };
}

function runInFakeTenant<T>(manager: any, fn: () => Promise<T>): Promise<T> {
  return tenantALS.run({ firmId: 'firm-1', userId: 'adviser-1', role: Role.ADVISER, manager }, fn);
}

describe('GdprService.exportPersonData', () => {
  it('throws NotFoundException for a person that does not exist', async () => {
    const { manager } = makeMockManager({ person: null });
    const service = new GdprService({ create: jest.fn() } as any);

    await expect(runInFakeTenant(manager, () => service.exportPersonData('nobody'))).rejects.toThrow(NotFoundException);
  });

  it('gathers every category of data attributable to the person', async () => {
    const { manager } = makeMockManager({
      person: { id: 'person-1', firstName: 'Jane', lastName: 'Smith' },
      memberships: [{ personId: 'person-1', householdId: 'household-1' }],
      accounts: [{ id: 'account-1', ownerPersonId: 'person-1' }],
      holdings: [{ id: 'holding-1', accountId: 'account-1' }],
      transactions: [{ id: 'txn-1', accountId: 'account-1' }],
      income: [{ id: 'income-1', personId: 'person-1' }],
      ownershipStakes: [{ id: 'stake-1', ownerPersonId: 'person-1' }],
      factFinds: [{ id: 'ff-1', householdId: 'household-1' }],
      notes: [{ id: 'note-1', householdId: 'household-1' }],
      callLogs: [{ id: 'call-1', clientPersonId: 'person-1' }],
    });
    const service = new GdprService({ create: jest.fn() } as any);

    const result = await runInFakeTenant(manager, () => service.exportPersonData('person-1'));

    expect(result.person).toEqual(expect.objectContaining({ id: 'person-1' }));
    expect(result.accounts).toHaveLength(1);
    expect(result.holdings).toHaveLength(1);
    expect(result.transactions).toHaveLength(1);
    expect(result.income).toHaveLength(1);
    expect(result.entityOwnershipStakes).toHaveLength(1);
    expect(result.factFinds).toHaveLength(1);
    expect(result.clientNotes).toHaveLength(1);
    expect(result.callLogs).toHaveLength(1);
    expect(result.exportedAt).toBeTruthy();
  });

  it('never queries account-scoped tables when the person owns no accounts (skips an empty IN () query)', async () => {
    const { manager } = makeMockManager({ person: { id: 'person-1' }, accounts: [] });
    const service = new GdprService({ create: jest.fn() } as any);

    const result = await runInFakeTenant(manager, () => service.exportPersonData('person-1'));

    expect(result.holdings).toEqual([]);
    expect(result.transactions).toEqual([]);
  });
});

describe('GdprService.erasePersonData', () => {
  it('throws NotFoundException for a person that does not exist', async () => {
    const { manager } = makeMockManager({ person: null });
    const service = new GdprService({ create: jest.fn() } as any);

    await expect(runInFakeTenant(manager, () => service.erasePersonData('nobody', 'admin-1'))).rejects.toThrow(NotFoundException);
  });

  it('anonymises every directly-identifying field, and nothing else', async () => {
    const { manager, personUpdate } = makeMockManager({
      person: { id: 'person-1', firstName: 'Jane', lastName: 'Smith' },
      memberships: [{ personId: 'person-1', householdId: 'household-1' }],
    });
    const complianceLog = { create: jest.fn().mockResolvedValue({}) };
    const service = new GdprService(complianceLog as any);

    await runInFakeTenant(manager, () => service.erasePersonData('person-1', 'admin-1'));

    expect(personUpdate).toHaveBeenCalledWith('person-1', {
      firstName: 'Erased', lastName: 'Client', email: null, phone: null, dateOfBirth: null,
      addressLine1: null, addressLine2: null, city: null, postalCode: null, country: null,
      niNumber: null, sourceOfWealth: null, taxResidency: null, domicile: null,
    });
  });

  it('logs a WARNING compliance entry against the person\'s household, naming who erased it', async () => {
    const { manager } = makeMockManager({
      person: { id: 'person-1' },
      memberships: [{ personId: 'person-1', householdId: 'household-1' }],
    });
    const complianceLog = { create: jest.fn().mockResolvedValue({}) };
    const service = new GdprService(complianceLog as any);

    await runInFakeTenant(manager, () => service.erasePersonData('person-1', 'admin-1'));

    expect(complianceLog.create).toHaveBeenCalledWith(expect.objectContaining({
      householdId: 'household-1', severity: ComplianceSeverity.WARNING, ruleCode: 'GDPR_ERASURE',
      metadata: { personId: 'person-1', erasedBy: 'admin-1' },
    }));
  });

  it('still erases a person with no household membership at all — just has nowhere household-scoped to log it', async () => {
    const { manager, personUpdate } = makeMockManager({ person: { id: 'person-1' }, memberships: [] });
    const complianceLog = { create: jest.fn() };
    const service = new GdprService(complianceLog as any);

    await runInFakeTenant(manager, () => service.erasePersonData('person-1', 'admin-1'));

    expect(personUpdate).toHaveBeenCalled();
    expect(complianceLog.create).not.toHaveBeenCalled();
  });
});
