import { Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { SyncService } from '../sync/sync.service';
import { VoiceService } from '../voice/voice.service';
import { AuthModule } from '../auth/auth.module';
import { DevicesModule } from '../devices/devices.module';
import { ActivityModule } from '../activity/activity.module';
import { RoomsModule } from '../rooms/rooms.module';
import { GamesModule } from '../games/games.module';

@Module({
  imports: [AuthModule, DevicesModule, ActivityModule, RoomsModule, GamesModule],
  providers: [RealtimeGateway, SyncService, VoiceService],
})
export class RealtimeModule {}
