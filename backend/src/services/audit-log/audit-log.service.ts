import { Injectable } from '@nestjs/common';
import { TenantContext } from '../../common/database/tenant-context';
import { AuditLogEntity } from '../../database/entities';

/**
 * Read-side interface over audit_log (writes happen exclusively via the
 * audit_row_change() Postgres trigger — see schema — never from application
 * code, so there is no create() here by design: the audit trail must not
 * be forgeable or skippable by a bug in a service method).
 */
@Injectable()
export class AuditLogService {
  async findForRow(tableName: string, rowId: string) {
    return TenantContext.getManager()
      .getRepository(AuditLogEntity)
      .find({ where: { tableName, rowId } as any, order: { changedAt: 'DESC' } as any });
  }

  async findRecentForFirm(limit = 100) {
    return TenantContext.getManager()
      .getRepository(AuditLogEntity)
      .find({ order: { changedAt: 'DESC' } as any, take: limit });
  }
}
