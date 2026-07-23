import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';

@ApiTags('rooms')
@UseGuards(JwtAuthGuard)
@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a shareable watch/listen party. Share the returned code with anyone to join.' })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateRoomDto) {
    return this.roomsService.create(user.sub, dto.name);
  }

  @Get(':code')
  @ApiOperation({ summary: 'Look up a room by its code before joining (used to confirm it exists / show host name).' })
  find(@Param('code') code: string) {
    return this.roomsService.findByCode(code);
  }
}
