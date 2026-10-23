import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LoggedInGuard } from '../auth/logged-in.guard';
import { User } from '../common/decorators/user.decorator';
import { Users } from '../entities/Users';
import { ApprovalsService } from './approvals.service';
import { CreateApprovalDto, DecideApprovalDto } from './dto/approval.dto';

@ApiTags('APPROVAL')
@ApiCookieAuth('connect.sid')
@UseGuards(LoggedInGuard)
@Controller('api/workspaces/:url/approvals')
export class ApprovalsController {
  constructor(private approvalsService: ApprovalsService) {}

  @ApiOperation({ summary: '결재 요청 (채널이나 DM 에 카드로 올린다)' })
  @Post()
  create(
    @Param('url') url: string,
    @Body() body: CreateApprovalDto,
    @User() user: Users,
  ) {
    return this.approvalsService.create(url, body, user.id);
  }

  @ApiOperation({ summary: '내가 결재할 차례인 것' })
  @Get('pending')
  pending(@Param('url') url: string, @User() user: Users) {
    return this.approvalsService.pending(url, user.id);
  }

  @ApiOperation({
    summary: '결재 하나 (요청자·결재자·카드를 올린 대화의 사람만)',
  })
  @Get(':id')
  get(
    @Param('url') url: string,
    @Param('id', ParseIntPipe) id: number,
    @User() user: Users,
  ) {
    return this.approvalsService.get(url, id, user.id);
  }

  @ApiOperation({ summary: '승인 또는 반려 (내 차례일 때)' })
  @Post(':id/decision')
  decide(
    @Param('url') url: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: DecideApprovalDto,
    @User() user: Users,
  ) {
    return this.approvalsService.decide(
      url,
      id,
      body.decision,
      body.comment,
      user.id,
    );
  }

  @ApiOperation({ summary: '요청 취소 (진행 중일 때, 요청한 사람만)' })
  @Post(':id/cancel')
  cancel(
    @Param('url') url: string,
    @Param('id', ParseIntPipe) id: number,
    @User() user: Users,
  ) {
    return this.approvalsService.cancel(url, id, user.id);
  }
}
