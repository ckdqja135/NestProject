import {
  BadRequestException,
  Body,
  Controller,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LoggedInGuard } from '../auth/logged-in.guard';
import { User } from '../common/decorators/user.decorator';
import { Users } from '../entities/Users';
import { ForwardDto } from './forward.dto';
import { ForwardService } from './forward.service';

@ApiTags('FORWARD')
@ApiCookieAuth('connect.sid')
@UseGuards(LoggedInGuard)
@Controller('api/workspaces/:url/forward')
export class ForwardController {
  constructor(private forwardService: ForwardService) {}

  @ApiOperation({ summary: '메시지를 다른 채널이나 DM 으로 전달' })
  @Post()
  forward(
    @Param('url') url: string,
    @Body() body: ForwardDto,
    @User() user: Users,
  ) {
    const target =
      body.to === 'channel'
        ? { to: 'channel' as const, target: String(body.target) }
        : { to: 'dm' as const, target: Number(body.target) };
    if (target.to === 'dm' && !Number.isInteger(target.target)) {
      throw new BadRequestException('보낼 사람이 올바르지 않습니다.');
    }
    return this.forwardService.forward(
      url,
      { source: body.source, id: body.id },
      target,
      body.comment || '',
      user.id,
    );
  }
}
