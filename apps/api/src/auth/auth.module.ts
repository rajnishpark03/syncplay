import { forwardRef, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { WsAuthService } from './guards/ws-jwt.guard';
import { ActivityModule } from '../activity/activity.module';

@Module({
  imports: [JwtModule.register({}), forwardRef(() => ActivityModule)],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, WsAuthService],
  exports: [AuthService, JwtAuthGuard, WsAuthService],
})
export class AuthModule {}
