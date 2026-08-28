import { Injectable } from '@nestjs/common';
import { DeepPartial } from 'typeorm';
import { BaseCrudService } from '../../common/database/base-crud.service';
import { ProviderEntity } from '../../database/entities';

@Injectable()
export class ProviderService extends BaseCrudService<ProviderEntity> {
  constructor() { super(ProviderEntity); }

  // Editing an email address without explicitly re-confirming it should
  // NOT carry the old "verified" flag forward onto a different, unverified
  // address — that would let a typo'd edit sail past the send-flow's
  // unverified-address warning silently.
  async update(id: string, data: DeepPartial<ProviderEntity>): Promise<ProviderEntity> {
    const touchesEmail = data.providerEmail !== undefined || data.servicingEmail !== undefined || data.newBusinessEmail !== undefined;
    if (touchesEmail && data.emailVerified === undefined) {
      data = { ...data, emailVerified: false };
    }
    return super.update(id, data);
  }
}
