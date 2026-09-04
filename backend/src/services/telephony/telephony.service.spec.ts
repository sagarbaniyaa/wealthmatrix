import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { Twilio } from 'twilio';
import { tenantALS } from '../../common/database/tenant-context';
import { Role } from '../../common/enums/role.enum';
import { ComplianceSeverity } from '../../common/enums/domain.enums';
import { ClientCallLogEntity, AppUserEntity, PersonEntity, HouseholdMemberEntity } from '../../database/entities';
import { TelephonyService, escapeXml } from './telephony.service';

jest.mock('twilio', () => ({ Twilio: jest.fn() }));

/**
 * Unit tests for the "click-to-call bridge" — the platform rings the
 * adviser's own phone first, then bridges the client in via inline
 * TwiML. Twilio itself is mocked out entirely; these cover the business
 * logic previously only verified by hand: which number gets called
 * first, the never-fabricate-success discipline when a phone number is
 * missing or Twilio errors, and that a client's name/number can never
 * break the generated TwiML XML.
 */

describe('escapeXml', () => {
  it('escapes &, <, >, and " together in one string', () => {
    expect(escapeXml(`Tom & Jerry <O'Brien> "The Boss"`)).toBe(`Tom &amp; Jerry &lt;O'Brien&gt; &quot;The Boss&quot;`);
  });

  it('leaves an apostrophe alone (not one of the escaped characters) but escapes amp/lt/gt/quote', () => {
    expect(escapeXml(`A & B`)).toBe('A &amp; B');
    expect(escapeXml(`<script>`)).toBe('&lt;script&gt;');
    expect(escapeXml(`"quoted"`)).toBe('&quot;quoted&quot;');
  });

  it('leaves ordinary text completely unchanged', () => {
    expect(escapeXml('Jane Smith')).toBe('Jane Smith');
  });
});

function makeMockManager(opts: { adviser?: Partial<AppUserEntity> | null; members?: Partial<HouseholdMemberEntity>[]; person?: Partial<PersonEntity> | null } = {}) {
  const savedRows: any[] = [];
  const callLogRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((f: any) => ({ ...f })),
    save: jest.fn((r: any) => { savedRows.push({ ...r }); return Promise.resolve({ id: 'call-log-1', ...r }); }),
  };
  const manager = {
    getRepository: jest.fn((entity: any) => {
      if (entity === ClientCallLogEntity) return callLogRepo;
      if (entity === AppUserEntity) return { findOne: jest.fn().mockResolvedValue(opts.adviser ?? null) };
      if (entity === HouseholdMemberEntity) return { find: jest.fn().mockResolvedValue(opts.members ?? []) };
      if (entity === PersonEntity) return { findOne: jest.fn().mockResolvedValue(opts.person ?? null) };
      throw new Error(`Unexpected repository requested: ${entity}`);
    }),
  };
  return { manager, callLogRepo, savedRows };
}

function runInFakeTenant<T>(manager: any, fn: () => Promise<T>): Promise<T> {
  return tenantALS.run({ firmId: 'firm-1', userId: 'adviser-1', role: Role.ADVISER, manager }, fn);
}

function configService(vars: Record<string, string | undefined>) {
  return { get: jest.fn((key: string) => vars[key]) } as any;
}

describe('TelephonyService.placeCall', () => {
  let complianceLog: { create: jest.Mock };
  let twilioCallsCreate: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    complianceLog = { create: jest.fn().mockResolvedValue({ id: 'log-1' }) };
    twilioCallsCreate = jest.fn().mockResolvedValue({ sid: 'CA123' });
    (Twilio as unknown as jest.Mock).mockImplementation(() => ({ calls: { create: twilioCallsCreate } }));
  });

  it('throws ServiceUnavailableException (never fabricates a call) when Twilio is not configured', async () => {
    const service = new TelephonyService(configService({}), complianceLog as any);
    const { manager } = makeMockManager();

    await expect(runInFakeTenant(manager, () => service.placeCall('household-1', 'adviser-1'))).rejects.toThrow(ServiceUnavailableException);
    expect(twilioCallsCreate).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when the adviser has no phone number on file', async () => {
    const service = new TelephonyService(
      configService({ TWILIO_ACCOUNT_SID: 'AC1', TWILIO_AUTH_TOKEN: 'tok', TWILIO_PHONE_NUMBER: '+441111111111' }),
      complianceLog as any,
    );
    const { manager } = makeMockManager({ adviser: { id: 'adviser-1', phone: null } });

    await expect(runInFakeTenant(manager, () => service.placeCall('household-1', 'adviser-1'))).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException naming the client when the client has no phone number on file', async () => {
    const service = new TelephonyService(
      configService({ TWILIO_ACCOUNT_SID: 'AC1', TWILIO_AUTH_TOKEN: 'tok', TWILIO_PHONE_NUMBER: '+441111111111' }),
      complianceLog as any,
    );
    const { manager } = makeMockManager({
      adviser: { id: 'adviser-1', phone: '+442222222222' },
      members: [{ personId: 'person-1', relationship: 'head' }],
      person: { id: 'person-1', firstName: 'Jane', lastName: 'Smith', phone: null },
    });

    await expect(runInFakeTenant(manager, () => service.placeCall('household-1', 'adviser-1'))).rejects.toThrow('Jane Smith has no phone number on file.');
  });

  it('throws BadRequestException when the household has no members at all', async () => {
    const service = new TelephonyService(
      configService({ TWILIO_ACCOUNT_SID: 'AC1', TWILIO_AUTH_TOKEN: 'tok', TWILIO_PHONE_NUMBER: '+441111111111' }),
      complianceLog as any,
    );
    const { manager } = makeMockManager({ adviser: { id: 'adviser-1', phone: '+442222222222' }, members: [] });

    await expect(runInFakeTenant(manager, () => service.placeCall('household-1', 'adviser-1'))).rejects.toThrow('This household has no members recorded.');
  });

  it('rings the ADVISER first (Twilio "to"), never the client directly, and bridges the client via the TwiML <Dial>', async () => {
    const service = new TelephonyService(
      configService({ TWILIO_ACCOUNT_SID: 'AC1', TWILIO_AUTH_TOKEN: 'tok', TWILIO_PHONE_NUMBER: '+441111111111', BACKEND_PUBLIC_URL: 'https://app.wealthmatrix.local' }),
      complianceLog as any,
    );
    const { manager, savedRows } = makeMockManager({
      adviser: { id: 'adviser-1', phone: '+442222222222' },
      members: [{ personId: 'person-1', relationship: 'head' }],
      person: { id: 'person-1', firstName: 'Jane', lastName: 'Smith', phone: '+443333333333' },
    });

    const result = await runInFakeTenant(manager, () => service.placeCall('household-1', 'adviser-1'));

    const call = twilioCallsCreate.mock.calls[0][0];
    expect(call.to).toBe('+442222222222'); // the adviser's own number, rung first
    expect(call.from).toBe('+441111111111');
    expect(call.twiml).toContain('<Dial callerId="+441111111111">+443333333333</Dial>');
    expect(call.twiml).toContain('Connecting you to Jane Smith now.');
    expect(call.statusCallback).toBe('https://app.wealthmatrix.local/telephony/status-callback?callLogId=call-log-1&firmId=firm-1');

    expect(result.status).toBe('ringing');
    expect(result.twilioCallSid).toBe('CA123');
    expect(savedRows[0].toNumber).toBe('+443333333333'); // client's number, on the DB row
    expect(complianceLog.create).toHaveBeenCalledWith(expect.objectContaining({ severity: ComplianceSeverity.INFO, ruleCode: 'CLIENT_CALL_PLACED' }));
  });

  it('escapes a client name containing XML-significant characters so the TwiML stays well-formed', async () => {
    const service = new TelephonyService(
      configService({ TWILIO_ACCOUNT_SID: 'AC1', TWILIO_AUTH_TOKEN: 'tok', TWILIO_PHONE_NUMBER: '+441111111111' }),
      complianceLog as any,
    );
    const { manager } = makeMockManager({
      adviser: { id: 'adviser-1', phone: '+442222222222' },
      members: [{ personId: 'person-1', relationship: 'head' }],
      person: { id: 'person-1', firstName: 'A & B', lastName: '<Ltd>', phone: '+443333333333' },
    });

    await runInFakeTenant(manager, () => service.placeCall('household-1', 'adviser-1'));

    const twiml = twilioCallsCreate.mock.calls[0][0].twiml;
    expect(twiml).toContain('Connecting you to A &amp; B &lt;Ltd&gt; now.');
    expect(twiml).not.toContain('A & B <Ltd>'); // the raw, unescaped form must never appear
  });

  it('omits the statusCallback entirely (not a broken URL) when BACKEND_PUBLIC_URL is not configured', async () => {
    const service = new TelephonyService(
      configService({ TWILIO_ACCOUNT_SID: 'AC1', TWILIO_AUTH_TOKEN: 'tok', TWILIO_PHONE_NUMBER: '+441111111111' }),
      complianceLog as any,
    );
    const { manager } = makeMockManager({
      adviser: { id: 'adviser-1', phone: '+442222222222' },
      members: [{ personId: 'person-1', relationship: 'head' }],
      person: { id: 'person-1', firstName: 'Jane', lastName: 'Smith', phone: '+443333333333' },
    });

    await runInFakeTenant(manager, () => service.placeCall('household-1', 'adviser-1'));

    expect(twilioCallsCreate.mock.calls[0][0].statusCallback).toBeUndefined();
  });

  it('records a FAILED call log with the Twilio error, never a fabricated success, when Twilio itself errors', async () => {
    twilioCallsCreate.mockRejectedValue(new Error('The number +442222222222 is not a valid phone number.'));
    const service = new TelephonyService(
      configService({ TWILIO_ACCOUNT_SID: 'AC1', TWILIO_AUTH_TOKEN: 'tok', TWILIO_PHONE_NUMBER: '+441111111111' }),
      complianceLog as any,
    );
    const { manager } = makeMockManager({
      adviser: { id: 'adviser-1', phone: '+442222222222' },
      members: [{ personId: 'person-1', relationship: 'head' }],
      person: { id: 'person-1', firstName: 'Jane', lastName: 'Smith', phone: '+443333333333' },
    });

    const result = await runInFakeTenant(manager, () => service.placeCall('household-1', 'adviser-1'));

    expect(result.status).toBe('failed');
    expect(result.errorMessage).toBe('The number +442222222222 is not a valid phone number.');
    expect(result.endedAt).toBeInstanceOf(Date);
    expect(complianceLog.create).toHaveBeenCalledWith(expect.objectContaining({ severity: ComplianceSeverity.WARNING, ruleCode: 'CLIENT_CALL_PLACED' }));
  });

  it('never lets a broken compliance log write fail the call placement itself', async () => {
    complianceLog.create.mockRejectedValue(new Error('compliance_log insert failed'));
    const service = new TelephonyService(
      configService({ TWILIO_ACCOUNT_SID: 'AC1', TWILIO_AUTH_TOKEN: 'tok', TWILIO_PHONE_NUMBER: '+441111111111' }),
      complianceLog as any,
    );
    const { manager } = makeMockManager({
      adviser: { id: 'adviser-1', phone: '+442222222222' },
      members: [{ personId: 'person-1', relationship: 'head' }],
      person: { id: 'person-1', firstName: 'Jane', lastName: 'Smith', phone: '+443333333333' },
    });

    await expect(runInFakeTenant(manager, () => service.placeCall('household-1', 'adviser-1'))).resolves.toEqual(expect.objectContaining({ status: 'ringing' }));
  });
});

describe('TelephonyService.applyStatusCallback', () => {
  it('is a no-op when the call log row does not exist', async () => {
    const { manager, callLogRepo } = makeMockManager();
    callLogRepo.findOne.mockResolvedValue(null);
    const service = new TelephonyService(configService({}), { create: jest.fn() } as any);

    await runInFakeTenant(manager, () => service.applyStatusCallback('nonexistent', 'completed', '120'));
    expect(callLogRepo.save).not.toHaveBeenCalled();
  });

  it('updates status and duration, and sets endedAt for a terminal status', async () => {
    const { manager, callLogRepo } = makeMockManager();
    const row: any = { id: 'call-log-1', status: 'ringing', durationSeconds: null, endedAt: null };
    callLogRepo.findOne.mockResolvedValue(row);
    const service = new TelephonyService(configService({}), { create: jest.fn() } as any);

    await runInFakeTenant(manager, () => service.applyStatusCallback('call-log-1', 'completed', '95'));

    expect(row.status).toBe('completed');
    expect(row.durationSeconds).toBe(95);
    expect(row.endedAt).toBeInstanceOf(Date);
  });

  it('does NOT set endedAt for a non-terminal status update (e.g. "ringing" -> "in-progress")', async () => {
    const { manager, callLogRepo } = makeMockManager();
    const row: any = { id: 'call-log-1', status: 'ringing', durationSeconds: null, endedAt: null };
    callLogRepo.findOne.mockResolvedValue(row);
    const service = new TelephonyService(configService({}), { create: jest.fn() } as any);

    await runInFakeTenant(manager, () => service.applyStatusCallback('call-log-1', 'in-progress', undefined));

    expect(row.status).toBe('in-progress');
    expect(row.endedAt).toBeNull();
  });
});
