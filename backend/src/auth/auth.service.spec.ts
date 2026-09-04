import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Role } from '../common/enums/role.enum';
import { AppUserEntity, FirmEntity, CurrencyEntity, PasswordResetTokenEntity } from '../database/entities';
import { AuthService } from './auth.service';

/**
 * AuthService's new flows (signup, forgot/reset password) — login was
 * already covered end-to-end by the integration suite, so these focus
 * on what only a unit test can practically probe: the exact security
 * property forgotPassword must hold (an identical response whether or
 * not the account exists), and reset-token validity rules.
 */

function makeMockQueryRunner(repos: Record<string, any>) {
  const manager = {
    getRepository: jest.fn((entity: any) => {
      const repo = repos.get ? repos.get(entity) : repos[entity];
      if (!repo) throw new Error(`Unexpected repository requested: ${entity}`);
      return repo;
    }),
  };
  return {
    connect: jest.fn().mockResolvedValue(undefined),
    startTransaction: jest.fn().mockResolvedValue(undefined),
    query: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
    manager,
  };
}

function reposMap(entries: [any, any][]) {
  const map = new Map(entries);
  return { get: (k: any) => map.get(k) };
}

describe('AuthService', () => {
  let jwt: { sign: jest.Mock };
  let config: { get: jest.Mock };
  let mailer: { send: jest.Mock };
  let dataSource: any;
  let service: AuthService;

  beforeEach(() => {
    jwt = { sign: jest.fn().mockReturnValue('signed.jwt.token') };
    config = { get: jest.fn((_key: string, fallback?: unknown) => fallback) };
    mailer = { send: jest.fn().mockResolvedValue({ messageId: 'msg-1' }) };
    dataSource = { getRepository: jest.fn(), createQueryRunner: jest.fn() };
    service = new AuthService(dataSource, jwt as any, config as any, mailer as any);
  });

  describe('signup', () => {
    it('creates a new firm and its first user as ADMIN, and returns a token', async () => {
      const firmRepo = { create: jest.fn((f: any) => f), save: jest.fn((f: any) => Promise.resolve({ id: 'firm-1', ...f })) };
      const currencyRepo = { findOne: jest.fn().mockResolvedValue({ id: 'gbp-1', code: 'GBP' }) };
      const userRepo = { create: jest.fn((u: any) => u), save: jest.fn((u: any) => Promise.resolve({ id: 'user-1', ...u })) };
      const qr = makeMockQueryRunner(reposMap([[FirmEntity, firmRepo], [CurrencyEntity, currencyRepo], [AppUserEntity, userRepo]]));
      dataSource.createQueryRunner.mockReturnValue(qr);

      const result = await service.signup({ firmName: 'Smith Wealth', adviserName: 'Jane Smith', email: 'jane@smithwealth.local', password: 'correcthorsebattery' });

      expect(firmRepo.save).toHaveBeenCalledWith(expect.objectContaining({ name: 'Smith Wealth', baseCurrencyId: 'gbp-1' }));
      expect(userRepo.save).toHaveBeenCalledWith(expect.objectContaining({ firmId: 'firm-1', role: Role.ADMIN, email: 'jane@smithwealth.local' }));
      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.user).toEqual(expect.objectContaining({ firmId: 'firm-1', role: Role.ADMIN }));
      expect(qr.commitTransaction).toHaveBeenCalled();
    });

    it('hashes the password with bcrypt before storing it — never the plaintext', async () => {
      const firmRepo = { create: jest.fn((f: any) => f), save: jest.fn((f: any) => Promise.resolve({ id: 'firm-1', ...f })) };
      const currencyRepo = { findOne: jest.fn().mockResolvedValue(null) };
      const userRepo = { create: jest.fn((u: any) => u), save: jest.fn((u: any) => Promise.resolve({ id: 'user-1', ...u })) };
      const qr = makeMockQueryRunner(reposMap([[FirmEntity, firmRepo], [CurrencyEntity, currencyRepo], [AppUserEntity, userRepo]]));
      dataSource.createQueryRunner.mockReturnValue(qr);

      await service.signup({ firmName: 'Smith Wealth', adviserName: 'Jane Smith', email: 'jane@smithwealth.local', password: 'correcthorsebattery' });

      const storedHash = userRepo.save.mock.calls[0][0].passwordHash;
      expect(storedHash).not.toBe('correcthorsebattery');
      expect(await bcrypt.compare('correcthorsebattery', storedHash)).toBe(true);
    });

    it('rolls back and releases the connection when the firm currency lookup or user save fails', async () => {
      const firmRepo = { create: jest.fn((f: any) => f), save: jest.fn((f: any) => Promise.resolve({ id: 'firm-1', ...f })) };
      const currencyRepo = { findOne: jest.fn().mockResolvedValue(null) };
      const userRepo = { create: jest.fn((u: any) => u), save: jest.fn().mockRejectedValue(new Error('duplicate key')) };
      const qr = makeMockQueryRunner(reposMap([[FirmEntity, firmRepo], [CurrencyEntity, currencyRepo], [AppUserEntity, userRepo]]));
      dataSource.createQueryRunner.mockReturnValue(qr);

      await expect(service.signup({ firmName: 'X', adviserName: 'Y', email: 'y@x.local', password: 'correcthorsebattery' })).rejects.toThrow('duplicate key');
      expect(qr.rollbackTransaction).toHaveBeenCalled();
      expect(qr.release).toHaveBeenCalled();
    });
  });

  describe('forgotPassword', () => {
    function setupSingleFirm(userFound: Partial<AppUserEntity> | null) {
      dataSource.getRepository.mockReturnValue({ find: jest.fn().mockResolvedValue([{ id: 'firm-1' }]) });
      const userRepo = { findOne: jest.fn().mockResolvedValue(userFound) };
      const tokenRepo = { create: jest.fn((t: any) => t), save: jest.fn((t: any) => Promise.resolve({ id: 'token-1', ...t })) };
      const qr = makeMockQueryRunner(reposMap([[AppUserEntity, userRepo], [PasswordResetTokenEntity, tokenRepo]]));
      // Once, not persistent: a test that sets up two calls in a row
      // (found vs. not-found) needs each forgotPassword() invocation to
      // get its OWN queryRunner, not both silently sharing whichever was
      // configured last.
      dataSource.createQueryRunner.mockReturnValueOnce(qr);
      return { userRepo, tokenRepo, qr };
    }

    it('returns the exact same message whether or not the account exists — never lets a caller distinguish the two', async () => {
      const found = setupSingleFirm({ id: 'user-1', email: 'real@firm.local' });
      const notFound = setupSingleFirm(null);

      const resultFound = await service.forgotPassword({ email: 'real@firm.local' });
      const resultNotFound = await service.forgotPassword({ email: 'nobody@firm.local' });

      expect(resultFound).toEqual(resultNotFound);
      expect(found.tokenRepo.save).toHaveBeenCalled();
      expect(notFound.tokenRepo.save).not.toHaveBeenCalled();
    });

    it('emails a reset link containing the raw token and the firm id when the account exists', async () => {
      setupSingleFirm({ id: 'user-1', email: 'real@firm.local' } as any);

      await service.forgotPassword({ email: 'real@firm.local' });

      expect(mailer.send).toHaveBeenCalledWith(expect.objectContaining({
        to: 'real@firm.local',
        body: expect.stringContaining('firmId=firm-1'),
      }));
    });

    it('still returns the generic success message (never throws to the caller) when sending the email fails', async () => {
      setupSingleFirm({ id: 'user-1', email: 'real@firm.local' } as any);
      mailer.send.mockRejectedValue(new Error('SMTP not configured'));

      await expect(service.forgotPassword({ email: 'real@firm.local' })).resolves.toEqual({
        message: 'If an account exists for that email, a password reset link has been sent.',
      });
    });
  });

  describe('resetPassword', () => {
    function setupWithToken(token: Partial<PasswordResetTokenEntity> | null) {
      const tokenRepo = { findOne: jest.fn().mockResolvedValue(token), update: jest.fn().mockResolvedValue({}) };
      const userRepo = { update: jest.fn().mockResolvedValue({}) };
      const qr = makeMockQueryRunner(reposMap([[PasswordResetTokenEntity, tokenRepo], [AppUserEntity, userRepo]]));
      dataSource.createQueryRunner.mockReturnValue(qr);
      return { tokenRepo, userRepo, qr };
    }

    it('rejects a token that does not exist', async () => {
      setupWithToken(null);
      await expect(service.resetPassword({ firmId: 'firm-1', token: 'bogus', newPassword: 'correcthorsebattery' })).rejects.toThrow(BadRequestException);
    });

    it('rejects an expired token', async () => {
      setupWithToken({ id: 'token-1', appUserId: 'user-1', usedAt: null, expiresAt: new Date(Date.now() - 1000) });
      await expect(service.resetPassword({ firmId: 'firm-1', token: 'expired', newPassword: 'correcthorsebattery' })).rejects.toThrow(BadRequestException);
    });

    it('rejects an already-used token (no replay)', async () => {
      setupWithToken({ id: 'token-1', appUserId: 'user-1', usedAt: new Date(), expiresAt: new Date(Date.now() + 3_600_000) });
      await expect(service.resetPassword({ firmId: 'firm-1', token: 'used', newPassword: 'correcthorsebattery' })).rejects.toThrow(BadRequestException);
    });

    it('updates the password hash and marks the token used on a valid reset', async () => {
      const { tokenRepo, userRepo } = setupWithToken({ id: 'token-1', appUserId: 'user-1', usedAt: null, expiresAt: new Date(Date.now() + 3_600_000) });

      const result = await service.resetPassword({ firmId: 'firm-1', token: 'valid-token', newPassword: 'correcthorsebattery' });

      expect(userRepo.update).toHaveBeenCalledWith('user-1', { passwordHash: expect.any(String) });
      const newHash = userRepo.update.mock.calls[0][1].passwordHash;
      expect(await bcrypt.compare('correcthorsebattery', newHash)).toBe(true);
      expect(tokenRepo.update).toHaveBeenCalledWith('token-1', { usedAt: expect.any(Date) });
      expect(result.message).toContain('reset');
    });
  });
});
