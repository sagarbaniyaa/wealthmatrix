import { AsyncLocalStorage } from 'async_hooks';
import { EntityManager } from 'typeorm';
import { Role } from '../enums/role.enum';

export interface TenantStore {
  firmId: string;
  userId: string;
  role: Role;
  manager: EntityManager;
}

export const tenantALS = new AsyncLocalStorage<TenantStore>();

/**
 * Access point for the current request's tenant-scoped EntityManager.
 * Throws loudly if used outside a request that went through
 * TenantTransactionInterceptor — this is deliberate: a service that
 * forgets to use the tenant-scoped manager would otherwise silently
 * fall back to an RLS-blind connection.
 */
export class TenantContext {
  static get(): TenantStore {
    const store = tenantALS.getStore();
    if (!store) {
      throw new Error(
        'TenantContext accessed outside of a tenant-scoped request. ' +
          'Ensure TenantTransactionInterceptor is applied globally and ' +
          'the route is behind JwtAuthGuard.',
      );
    }
    return store;
  }

  static getManager(): EntityManager {
    return TenantContext.get().manager;
  }

  static getFirmId(): string {
    return TenantContext.get().firmId;
  }

  static getUserId(): string {
    return TenantContext.get().userId;
  }

  static getRole(): Role {
    return TenantContext.get().role;
  }
}
