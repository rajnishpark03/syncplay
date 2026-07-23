import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateRoomDto {
  @ApiProperty({ required: false, example: 'Friday movie night' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  name?: string;
}
