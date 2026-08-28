import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantContext } from '../../common/database/tenant-context';
import {
  HouseholdEntity, HouseholdMemberEntity, PersonEntity, AppUserEntity, FirmEntity, AccountEntity,
} from '../../database/entities';

/**
 * Builds the {{token}} -> value map the autofill engine substitutes into
 * an LOA template. Same "primary member" heuristic as
 * FundSuitabilityService (household_member with relationship='head', else
 * the first member) — a starting point, not a full joint-applicant model
 * (see README Known gaps: LOAs for a household with co-applicants still
 * only autofill the primary contact's details).
 */
@Injectable()
export class LoaTokenBuilderService {
  async buildTokens(householdId: string, adviserId: string): Promise<Record<string, string>> {
    const manager = TenantContext.getManager();

    const household = await manager.getRepository(HouseholdEntity).findOne({ where: { id: householdId } as any });
    if (!household) throw new NotFoundException(`Household ${householdId} not found`);

    const members = await manager.getRepository(HouseholdMemberEntity).find({ where: { householdId } as any });
    const primaryMember = members.find((m) => m.relationship === 'head') ?? members[0] ?? null;
    const primaryPerson = primaryMember
      ? await manager.getRepository(PersonEntity).findOne({ where: { id: primaryMember.personId } as any })
      : null;

    const adviser = await manager.getRepository(AppUserEntity).findOne({ where: { id: adviserId } as any });
    const firm = adviser ? await manager.getRepository(FirmEntity).findOne({ where: { id: adviser.firmId } as any }) : null;

    const accounts = primaryPerson
      ? await manager.getRepository(AccountEntity).find({ where: { ownerPersonId: primaryPerson.id } as any })
      : [];
    const policyNumbers = accounts.map((a) => a.policyNumber).filter((p): p is string => !!p);
    const existingProviders = Array.from(new Set(accounts.map((a) => a.provider).filter((p): p is string => !!p)));

    const clientAddress = joinAddress(primaryPerson?.addressLine1, primaryPerson?.addressLine2, primaryPerson?.city, primaryPerson?.postalCode, primaryPerson?.country);
    const adviserAddress = joinAddress(adviser?.addressLine1 ?? null, null, adviser?.city ?? null, adviser?.postalCode ?? null, null);

    return {
      client_name: primaryPerson ? `${primaryPerson.firstName} ${primaryPerson.lastName}` : '',
      client_first_name: primaryPerson?.firstName ?? '',
      client_last_name: primaryPerson?.lastName ?? '',
      client_DOB: primaryPerson?.dateOfBirth ?? '',
      client_address: clientAddress,
      client_email: primaryPerson?.email ?? '',
      client_phone: primaryPerson?.phone ?? '',
      client_NI: primaryPerson?.niNumber ?? '',
      policy_number: policyNumbers.join(', '),
      existing_provider: existingProviders.join(', '),
      household_name: household.name,

      adviser_name: adviser?.displayName ?? adviser?.email ?? '',
      adviser_email: adviser?.email ?? '',
      adviser_phone: adviser?.phone ?? '',
      adviser_address: adviserAddress,
      adviser_firm: firm?.name ?? '',
      adviser_FCA: firm?.fcaReference ?? '',

      today_date: new Date().toISOString().slice(0, 10),
      // provider_name is filled in per-send by ProviderSendService, once
      // the specific provider is known — not available at token-build time.
      provider_name: '',
    };
  }
}

function joinAddress(line1?: string | null, line2?: string | null, city?: string | null, postalCode?: string | null, country?: string | null): string {
  return [line1, line2, city, postalCode, country].filter(Boolean).join(', ');
}
