import { forwardRef, Module } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { RoomPresenceService } from './room-presence.service';
import { RoomsController } from './rooms.controller';
import { AuthModule } from '../auth/auth.module';
import { DevicesModule } from '../devices/devices.module';

@Module({
  imports: [forwardRef(() => AuthModule), DevicesModule],
  controllers: [RoomsController],
  providers: [RoomsService, RoomPresenceService],
  exports: [RoomsService, RoomPresenceService],
})
export class RoomsModule {}
