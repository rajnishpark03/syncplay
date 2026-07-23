import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ActivityService } from './activity.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';

@ApiTags('activity')
@UseGuards(JwtAuthGuard)
@Controller('activity')
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get()
  @ApiOperation({ summary: 'Account-level activity feed (device connect/disconnect, etc).' })
  recent(@CurrentUser() user: RequestUser, @Query('limit') limit?: string) {
    return this.activityService.recentForUser(user.sub, limit ? parseInt(limit, 10) : undefined);
  }

  @Get('room/:code')
  @ApiOperation({ summary: "Activity feed for a specific room's session (what the Sync screen shows)." })
  recentForRoom(@Param('code') code: string, @Query('limit') limit?: string) {
    return this.activityService.recentForRoom(code.toUpperCase(), limit ? parseInt(limit, 10) : undefined);
  }
}
