import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Observable, from } from 'rxjs';
import { switchMap, finalize } from 'rxjs/operators';
import { tenantALS } from './tenant-context';

/**
 * Wraps every authenticated request in a single DB transaction and issues
 * set_config('app.current_firm_id', ...) / ('app.current_user_id', ...)
 * on that transaction's connection before any repository code runs. This
 * is what makes Postgres RLS policies and the audit trigger's
 * current_setting() calls actually see the right tenant/user.
 *
 * The third set_config argument (true) makes it LOCAL — scoped to the
 * transaction, auto-reset on commit/rollback. Because it's connection-
 * scoped, every query for this request MUST run through this exact
 * QueryRunner's manager (TenantContext.getManager()) — never through
 * a repository pulled from a default pooled connection, which would
 * have no session vars set and get blocked (or worse, see nothing) by RLS.
 *
 * Public/unauthenticated routes (e.g. POST /auth/login) have no req.user
 * and skip transaction wrapping — they run on the default manager.
 */
@Injectable()
export class TenantTransactionInterceptor implements NestInterceptor {
  constructor(private readonly dataSource: DataSource) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const user = req.user as
      | { firmId: string; userId: string; role: string }
      | undefined;

    if (!user) {
      return next.handle();
    }

    const queryRunner = this.dataSource.createQueryRunner();

    return from(this.setUp(queryRunner, user)).pipe(
      switchMap(
        () =>
          new Observable((subscriber) => {
            tenantALS.run(
              {
                firmId: user.firmId,
                userId: user.userId,
                role: user.role as any,
                manager: queryRunner.manager,
              },
              () => {
                next.handle().subscribe({
                  next: (v) => subscriber.next(v),
                  error: async (err) => {
                    await this.tearDown(queryRunner, false);
                    subscriber.error(err);
                  },
                  complete: async () => {
                    await this.tearDown(queryRunner, true);
                    subscriber.complete();
                  },
                });
              },
            );
          }),
      ),
      finalize(() => queryRunner.release()),
    );
  }

  private async setUp(queryRunner: any, user: any) {
    await queryRunner.connect();
    await queryRunner.startTransaction();
    await queryRunner.query(
      `SELECT set_config('app.current_firm_id', $1, true), ` +
        `set_config('app.current_user_id', $2, true)`,
      [user.firmId, user.userId],
    );
  }

  private async tearDown(queryRunner: any, success: boolean) {
    try {
      if (success) {
        await queryRunner.commitTransaction();
      } else {
        await queryRunner.rollbackTransaction();
      }
    } catch {
      /* connection may already be closed/rolled back */
    }
  }
}
