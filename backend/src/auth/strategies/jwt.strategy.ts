import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

export interface JwtPayload {
  sub: string; // app_user.id
  firmId: string;
  role: string;
  email: string;
  personId: string | null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    // Fail loudly at startup rather than silently sign/verify every
    // token against "undefined" — an unset JWT_SECRET is a
    // misconfiguration, not something to limp along with.
    const secret = config.get<string>('JWT_SECRET');
    if (!secret) throw new Error('JWT_SECRET is not set — the application cannot start without it.');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  // Runs BEFORE TenantTransactionInterceptor — deliberately does NOT hit
  // the DB here (no tenant context/RLS session exists yet at this point
  // in the pipeline). Trusts the signed JWT claims; the interceptor then
  // opens the RLS-scoped transaction using exactly these values.
  async validate(payload: JwtPayload) {
    return {
      userId: payload.sub,
      firmId: payload.firmId,
      role: payload.role,
      email: payload.email,
      personId: payload.personId,
    };
  }
}
