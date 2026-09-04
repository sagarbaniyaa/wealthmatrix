import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AppUserEntity } from '../database/entities/app-user.entity';
import { FirmEntity } from '../database/entities/firm.entity';
import { CurrencyEntity } from '../database/entities/currency.entity';
import { PasswordResetTokenEntity } from '../database/entities/password-reset-token.entity';
import { Role } from '../common/enums/role.enum';
import { ProviderMailerService } from '../services/provider-hub/provider-mailer.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 hour
const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mailer: ProviderMailerService,
  ) {}

  /**
   * Resolves the firm to log into when the login form didn't ask for one.
   * `firm` carries no RLS (it's the tenant root), so this plain read is
   * safe outside any tenant context. Auto-resolving only works when the
   * whole system has exactly one firm — true for every demo/single-
   * tenant deployment of this platform — otherwise email alone can't
   * disambiguate which firm's user table to check, and firmId becomes
   * required again.
   */
  private async resolveFirmId(dataSource: DataSource, requestedFirmId: string | undefined): Promise<string> {
    if (requestedFirmId) return requestedFirmId;
    const firms = await dataSource.getRepository(FirmEntity).find({ take: 2 });
    if (firms.length === 1) return firms[0].id;
    throw new UnauthorizedException(
      firms.length === 0
        ? 'No firm is configured on this system.'
        : 'Multiple firms exist — a firm reference is required to log in.',
    );
  }

  /**
   * Every tenant-scoped write in this file needs the exact same shape:
   * open a transaction, SET the RLS session var, run the callback,
   * commit/rollback, always release. connect()/startTransaction() are
   * deliberately INSIDE their own try/finally — a bug in this same
   * shape (see common/database/run-in-tenant-context.ts) previously let
   * a connection/transaction-start failure skip release() entirely and
   * leak the connection back to the pool.
   */
  private async withFirmTransaction<T>(firmId: string, fn: (manager: EntityManager) => Promise<T>): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      await queryRunner.startTransaction();
      try {
        await queryRunner.query(`SELECT set_config('app.current_firm_id', $1, true)`, [firmId]);
        const result = await fn(queryRunner.manager);
        await queryRunner.commitTransaction();
        return result;
      } catch (err) {
        await queryRunner.rollbackTransaction();
        throw err;
      }
    } finally {
      await queryRunner.release();
    }
  }

  async login(dto: LoginDto) {
    const firmId = await this.resolveFirmId(this.dataSource, dto.firmId);

    return this.withFirmTransaction(firmId, async (manager) => {
      const user = await manager
        .getRepository(AppUserEntity)
        .createQueryBuilder('user')
        .addSelect('user.passwordHash')
        .where('user.email = :email', { email: dto.email })
        .andWhere('user.firmId = :firmId', { firmId })
        .andWhere('user.isActive = true')
        .getOne();

      if (!user || !(user as any).passwordHash) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const valid = await bcrypt.compare(dto.password, (user as any).passwordHash);
      if (!valid) {
        throw new UnauthorizedException('Invalid credentials');
      }

      return this.issueToken(user);
    });
  }

  /**
   * Self-service onboarding for a brand-new firm — before this existed,
   * the only way onto this platform was a manual DB insert. firm has no
   * RLS at all (see resolveFirmId above), so it's created first, outside
   * any tenant context; the RLS session var is then set for the REST of
   * this same transaction so the new app_user row can be written under
   * the firm it belongs to, same as everywhere else. The signer-upper
   * becomes that firm's first ADMIN — there's no one else yet who could
   * have assigned any other role.
   */
  async signup(dto: SignupDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      await queryRunner.startTransaction();
      try {
        const baseCurrency = await queryRunner.manager.getRepository(CurrencyEntity).findOne({ where: { code: 'GBP' } as any });

        const firm = await queryRunner.manager.getRepository(FirmEntity).save(
          queryRunner.manager.getRepository(FirmEntity).create({
            name: dto.firmName,
            baseCurrencyId: baseCurrency?.id ?? null,
            isActive: true,
          }),
        );

        await queryRunner.query(`SELECT set_config('app.current_firm_id', $1, true)`, [firm.id]);

        const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
        const user = await queryRunner.manager.getRepository(AppUserEntity).save(
          queryRunner.manager.getRepository(AppUserEntity).create({
            firmId: firm.id,
            email: dto.email,
            role: Role.ADMIN,
            displayName: dto.adviserName,
            passwordHash,
            isActive: true,
          }),
        );

        const result = this.issueToken(user);
        await queryRunner.commitTransaction();
        return result;
      } catch (err) {
        await queryRunner.rollbackTransaction();
        throw err;
      }
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Always returns the same generic response regardless of whether the
   * email/firm combination actually exists, whether SMTP is configured,
   * or whether the send itself fails — every one of those is swallowed
   * and logged server-side, never surfaced to the caller. Anything else
   * (a distinct error for "no such user" vs. "email failed to send")
   * would let an attacker enumerate which addresses have accounts.
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const message = 'If an account exists for that email, a password reset link has been sent.';
    try {
      const firmId = await this.resolveFirmId(this.dataSource, dto.firmId);

      // The token write is committed on its own, BEFORE the email send is
      // even attempted — email delivery genuinely fails sometimes (SMTP
      // not configured being the common local/demo case), and that must
      // never roll back a token that was already correctly generated.
      // withFirmTransaction rolls back on ANY error thrown inside its
      // callback, so send() cannot live inside the same one.
      const emailAndLink = await this.withFirmTransaction(firmId, async (manager) => {
        const user = await manager.getRepository(AppUserEntity).findOne({
          where: { email: dto.email, firmId, isActive: true } as any,
        });
        if (!user) return null; // deliberately identical to the found-and-emailed path from the caller's perspective

        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = this.hashToken(rawToken);
        await manager.getRepository(PasswordResetTokenEntity).save(
          manager.getRepository(PasswordResetTokenEntity).create({
            firmId,
            appUserId: user.id,
            tokenHash,
            expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
          }),
        );

        const frontendUrl = this.config.get<string>('FRONTEND_PUBLIC_URL', 'http://localhost:3001');
        return { to: user.email, resetLink: `${frontendUrl}/login/advisor/reset-password?token=${rawToken}&firmId=${firmId}` };
      });

      if (emailAndLink) {
        await this.mailer.send({
          to: emailAndLink.to,
          subject: 'Reset your WealthMatrix password',
          body: `A password reset was requested for your WealthMatrix account.\n\n` +
            `Reset your password: ${emailAndLink.resetLink}\n\n` +
            `This link expires in 1 hour. If you didn't request this, you can ignore this email.`,
          attachments: [],
        });
      }
    } catch (err) {
      // Logged, never rethrown — see the method comment on why this
      // response can't vary based on what actually happened.
      this.logger.warn(`forgotPassword did not complete cleanly: ${(err as Error).message}`);
    }
    return { message };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const tokenHash = this.hashToken(dto.token);

    await this.withFirmTransaction(dto.firmId, async (manager) => {
      const resetToken = await manager.getRepository(PasswordResetTokenEntity).findOne({
        where: { firmId: dto.firmId, tokenHash } as any,
      });

      if (!resetToken || resetToken.usedAt || resetToken.expiresAt.getTime() < Date.now()) {
        throw new BadRequestException('This password reset link is invalid or has expired — request a new one.');
      }

      const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
      await manager.getRepository(AppUserEntity).update(resetToken.appUserId, { passwordHash });
      await manager.getRepository(PasswordResetTokenEntity).update(resetToken.id, { usedAt: new Date() });
    });

    return { message: 'Your password has been reset — you can now log in.' };
  }

  private issueToken(user: AppUserEntity) {
    const payload = {
      sub: user.id,
      firmId: user.firmId,
      role: user.role,
      email: user.email,
      personId: user.personId ?? null,
    };
    return { accessToken: this.jwt.sign(payload), user: payload };
  }

  private hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }
}
