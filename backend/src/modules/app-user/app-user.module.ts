import { Module } from '@nestjs/common';
import { AppUserService } from './app-user.service';
import { AppUserController } from './app-user.controller';

@Module({ providers: [AppUserService], controllers: [AppUserController], exports: [AppUserService] })
export class AppUserModule {}
