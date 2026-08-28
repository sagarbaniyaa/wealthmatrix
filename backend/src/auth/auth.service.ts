import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AppUserEntity } from '../database/entities/app-user.entity';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.query(
        `SELECT set_config('app.current_firm_id', $1, true)`,
        [dto.firmId],
      );

      const user = await queryRunner.manager
        .getRepository(AppUserEntity)
        .createQueryBuilder('user')
        .addSelect('user.passwordHash')
        .where('user.email = :email', { email: dto.email })
        .andWhere('user.firmId = :firmId', { firmId: dto.firmId })
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