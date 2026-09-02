import { DataSource } from 'typeorm';
import { tenantALS } from './tenant-context';
import { Role } from '../enums/role.enum';

/**
 * The non-HTTP equivalent of TenantTransactionInterceptor — for code
 * that needs a correctly tenant-scoped EntityManager but has no incoming
 * request to intercept (a @Cron job). Same shape: open a transaction,
 * SET the RLS session vars on that transaction's connection, run the
 * callback inside the AsyncLocalStorage context every service already
 * reads via TenantContext.getManager(), then commit/rollback.
 *
 * `userId` is a synthetic actor id for audit_row_change()'s "who did
 * this" column — there's no real app_user behind a scheduled job, so
 * callers pass a fixed system identifier rather than an adviser's id.
 */
export async function runInTenantContext<T>(
  dataSource: DataSource,
  params: { firmId: string; userId: string; role?: Role },
  fn: () => Promise<T>,
): Promise<T> {
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();
  try {
    await queryRunner.query(
      `SELECT set_config('app.current_firm_id', $1, true), set_config('app.current_user_id', $2, true)`,
      [params.firmId, params.userId],
    );
    const result = await tenantALS.run(
      { firmId: params.firmId, userId: params.userId, role: params.role ?? Role.ADMIN, manager: queryRunner.manager },
      fn,
    );
    await queryRunner.commitTransaction();
    return result;
  } catch (err) {
    await queryRunner.rollbackTransaction();
    throw err;
  } finally {
    await queryRunner.release();
  }
}
