import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsString, Length, ValidateNested } from 'class-validator';
import { Platform } from '@syncplay/shared';

export class DeviceInputDto {
  @ApiProperty({ example: 'a1b2c3d4-...' , description: 'Client-generated, persisted device identifier'})
  @IsString()
  deviceId!: string;

  @ApiProperty({ example: "Rajnish's iPhone" })
  @IsString()
  name!: string;

  @ApiProperty({ enum: ['ios', 'android', 'web', 'desktop'] })
  @IsIn(['ios', 'android', 'web', 'desktop'])
  platform!: Platform;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  appVersion?: string;
}

export class VerifyOtpDto {
  @ApiProperty({ example: 'you@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  code!: string;

  @ApiProperty({ type: DeviceInputDto })
  @ValidateNested()
  @Type(() => DeviceInputDto)
  device!: DeviceInputDto;
}
