import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { UsersController } from './controller/users.controller';
import { UsersService } from './service/users.service';
import { PrismaModule } from '@app/prisma';
import { LocalStrategy } from './strategy/local.strategy';

@Module({
  imports: [PrismaModule, PassportModule],
  controllers: [UsersController],
  providers: [UsersService, LocalStrategy],
  exports: [UsersService],
})
export class UsersModule {}