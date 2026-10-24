import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { APP_EVENTS } from '../app-events.service';

export class CreateAppDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  @ApiProperty({ example: '배포 알림', description: '앱(봇) 이름' })
  public name: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @ApiProperty({ required: false })
  public description?: string;
}

export class UpdateAppDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  @ApiProperty({ required: false })
  public name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @ApiProperty({ required: false })
  public description?: string;

  // null 이면 이벤트를 보내지 않는다
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(500)
  @ApiProperty({
    required: false,
    nullable: true,
    description: '이벤트를 받을 주소 (저장할 때 url_verification 으로 확인)',
  })
  public eventUrl?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(500)
  @ApiProperty({
    required: false,
    nullable: true,
    description: '메시지 버튼을 누르면 보낼 주소 (비우면 이벤트 주소로)',
  })
  public interactionUrl?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(APP_EVENTS.length)
  @IsIn(APP_EVENTS, { each: true })
  @ApiProperty({ required: false, enum: APP_EVENTS, isArray: true })
  public events?: (typeof APP_EVENTS)[number][];
}

export class AppCommandDto {
  @Matches(/^[a-z0-9_-]{1,32}$/, {
    message: '명령은 영문 소문자·숫자·_·- 로 32자까지 쓸 수 있습니다.',
  })
  @ApiProperty({ example: 'deploy', description: "'/' 없이" })
  public command: string;

  @IsString()
  @MaxLength(500)
  @ApiProperty({ description: '명령을 입력하면 요청을 보낼 앱 주소' })
  public url: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @ApiProperty({ required: false })
  public description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @ApiProperty({ required: false, example: '서버이름' })
  public usageHint?: string;
}

export class AppChannelDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: '일반' })
  public channel: string;
}

export class RunCommandDto {
  @Matches(/^[a-z0-9_-]{1,32}$/)
  @ApiProperty({ example: 'deploy' })
  public command: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  @ApiProperty({ required: false })
  public text?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({
    required: false,
    description: '채널에서 입력했으면 채널 이름',
  })
  public channel?: string;

  @IsOptional()
  @IsInt()
  @ApiProperty({ required: false, description: 'DM 에서 입력했으면 상대 id' })
  public dmUserId?: number;
}

// ── 메시지 버튼

export class AppButtonDto {
  @Matches(/^[\w-]{1,40}$/, {
    message: '버튼 id 는 영문·숫자·_·- 로 40자까지입니다.',
  })
  @ApiProperty({ example: 'approve' })
  public id: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  @ApiProperty({ example: '승인' })
  public label: string;

  @IsOptional()
  @IsIn(['primary', 'danger'])
  @ApiProperty({ required: false, enum: ['primary', 'danger'] })
  public style?: 'primary' | 'danger';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @ApiProperty({ required: false, description: '누르면 앱에 그대로 돌려줄 값' })
  public value?: string;
}

export class RunActionDto {
  @IsOptional()
  @IsInt()
  @ApiProperty({ required: false, description: '채널 메시지 id' })
  public chatId?: number;

  @IsOptional()
  @IsInt()
  @ApiProperty({ required: false, description: 'DM 메시지 id' })
  public dmId?: number;

  @Matches(/^[\w-]{1,40}$/)
  @ApiProperty({ description: '누른 버튼 id' })
  public actionId: string;
}

// ── 앱 API (봇 토큰)

export class AppPostMessageDto {
  @IsOptional()
  @IsString()
  @ApiProperty({
    required: false,
    description: '채널 이름 (channel 과 userId 중 하나)',
  })
  public channel?: string;

  @IsOptional()
  @IsInt()
  @ApiProperty({ required: false, description: 'DM 받을 사람 id' })
  public userId?: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(8000)
  @ApiProperty({ example: '배포가 끝났어요 🚀' })
  public text: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @ApiProperty({
    required: false,
    description: '이 메시지의 스레드에 답글로 (채널만)',
  })
  public threadId?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => AppButtonDto)
  @ApiProperty({
    required: false,
    type: [AppButtonDto],
    description: '메시지 아래 버튼 (5개까지)',
  })
  public buttons?: AppButtonDto[];
}

export class AppMessageRefDto {
  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  public channel?: string;

  @IsOptional()
  @IsInt()
  @ApiProperty({ required: false, description: 'DM 상대 id' })
  public userId?: number;

  @IsInt()
  @Min(1)
  @ApiProperty()
  public messageId: number;
}

export class AppUpdateMessageDto extends AppMessageRefDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(8000)
  @ApiProperty()
  public text: string;

  // 주지 않으면 버튼을 뗀다
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => AppButtonDto)
  @ApiProperty({ required: false, type: [AppButtonDto] })
  public buttons?: AppButtonDto[];
}

export class AppReactionDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  public channel: string;

  @IsInt()
  @Min(1)
  @ApiProperty()
  public messageId: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(16)
  @ApiProperty({ example: '👍' })
  public emoji: string;
}

export class AppRespondDto {
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  @ApiProperty({ required: false })
  public text?: string;

  @IsOptional()
  @IsIn(['in_channel', 'ephemeral'])
  @ApiProperty({ required: false, enum: ['in_channel', 'ephemeral'] })
  public response_type?: 'in_channel' | 'ephemeral';
}
