import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Much tighter than the global 100/min default — login is THE classic
  // brute-force/credential-stuffing target, and unlike every other
  // endpoint here it's reachable with no auth at all. 5 attempts/minute
  // per IP is generous for a genuine mistyped password, punishing for
  // an automated guessing loop.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}
