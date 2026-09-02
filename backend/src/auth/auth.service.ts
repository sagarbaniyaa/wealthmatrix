import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AppUserEntity } from '../database/entities/app-user.entity';
import { FirmEntity } from '../database/entities/firm.entity';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly jwt: JwtService,
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

  async login(dto: LoginDto) {
    const firmId = await this.resolveFirmId(this.dataSource, dto.firmId);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.query(
        `SELECT set_config('app.current_firm_id', $1, true)`,
        [firmId],
      );

      const user = await queryRunner.manager
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

      const payload = {
        sub: user.id,
        firmId: user.firmId,
        role: user.role,
        email: user.email,
        personId: user.personId ?? null,
      };

      await queryRunner.commitTransaction();

      return {
        accessToken: this.jwt.sign(payload),
        user: payload,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}