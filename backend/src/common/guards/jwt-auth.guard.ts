import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// req.user is populated by JwtStrategy.validate() as { userId, firmId, role, email, personId }.
// TenantTransactionInterceptor reads req.user, so this guard MUST run before that interceptor
// on every protected route (guards run before interceptors in Nest's pipeline — no extra wiring needed).
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
