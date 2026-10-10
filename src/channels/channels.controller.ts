import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiConsumes,
  ApiCookieAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { LoggedInGuard } from '../auth/logged-in.guard';
import { User } from '../common/decorators/user.decorator';
import { InviteMemberDto } from '../common/dto/invite-member.dto';
import { PostChatDto } from '../common/dto/post-chat.dto';
import { ReactionDto } from '../common/dto/reaction.dto';
import { MAX_FILES, normalizeIds, relayUploadOptions } from '../common/upload';
import { Users } from '../entities/Users';
import { ChannelsService } from './channels.service';
import { CreateChannelDto } from './dto/create-channel.dto';

// 한 번에 가져오는 채팅 수 제한 (1~100)
const clampPerPage = (perPage: number) => Math.min(Math.max(perPage, 1), 100);

@ApiTags('CHANNEL')
@ApiCookieAuth('connect.sid')
@UseGuards(LoggedInGuard)
@Controller('api/workspaces/:url/channels')
export class ChannelsController {
  constructor(private channelsService: ChannelsService) {}

  @ApiOperation({ summary: '워크스페이스 내 내가 속한 채널 목록' })
  @Get()
  getAllChannels(@Param('url') url: string, @User() user: Users) {
    return this.channelsService.getWorkspaceChannels(url, user.id);
  }

  @ApiOperation({ summary: '채널 생성' })
  @Post()
  createChannels(
    @Param('url') url: string,
    @Body() body: CreateChannelDto,
    @User() user: Users,
  ) {
    return this.channelsService.createWorkspaceChannel(
      url,
      body.name,
      !!body.private,
      user.id,
    );
  }

  @ApiOperation({ summary: '채널 둘러보기 (공개 채널 목록)' })
  @Get('browse')
  browseChannels(@Param('url') url: string, @User() user: Users) {
    return this.channelsService.browsePublicChannels(url, user.id);
  }

  @ApiOperation({ summary: '공개 채널 참여 (비공개 채널은 초대로만 참여)' })
  @Post(':name/join')
  joinChannel(
    @Param('url') url: string,
    @Param('name') name: string,
    @User() user: Users,
  ) {
    return this.channelsService.joinChannel(url, name, user.id);
  }

  @ApiOperation({ summary: '특정 채널 정보' })
  @Get(':name')
  getSpecificChannel(
    @Param('url') url: string,
    @Param('name') name: string,
    @User() user: Users,
  ) {
    return this.channelsService.getWorkspaceChannel(url, name, user.id);
  }

  @ApiOperation({ summary: '채널 채팅 목록' })
  @ApiQuery({ name: 'perPage', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({
    name: 'beforeId',
    required: false,
    description: '이 메시지 id 보다 오래된 메시지 (커서, page 대신 사용 권장)',
  })
  @Get(':name/chats')
  getChats(
    @Param('url') url: string,
    @Param('name') name: string,
    @Query('perPage', new DefaultValuePipe(20), ParseIntPipe) perPage: number,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('beforeId', new DefaultValuePipe(0), ParseIntPipe) beforeId: number, // 0 이면 커서 없음
    @User() user: Users,
  ) {
    return this.channelsService.getWorkspaceChannelChats(
      url,
      name,
      clampPerPage(perPage),
      Math.max(page, 1),
      user.id,
      beforeId,
    );
  }

  @ApiOperation({ summary: '안 읽은 채팅 개수' })
  @ApiQuery({ name: 'after', required: false })
  @Get(':name/unreads')
  getUnreads(
    @Param('url') url: string,
    @Param('name') name: string,
    @Query('after', new DefaultValuePipe(0), ParseIntPipe) after: number,
    @User() user: Users,
  ) {
    return this.channelsService.getChannelUnreadsCount(
      url,
      name,
      after,
      user.id,
    );
  }

  @ApiOperation({ summary: '채널 채팅 전송 (저장된 메시지 반환)' })
  @Post(':name/chats')
  postChat(
    @Param('url') url: string,
    @Param('name') name: string,
    @Body() body: PostChatDto,
    @User() user: Users,
  ) {
    return this.channelsService.postChat(url, name, body.content, user.id);
  }

  @ApiOperation({ summary: '채널 메시지 수정 (작성자만)' })
  @Patch(':name/chats/:chatId')
  editChat(
    @Param('url') url: string,
    @Param('name') name: string,
    @Param('chatId', ParseIntPipe) chatId: number,
    @Body() body: PostChatDto,
    @User() user: Users,
  ) {
    return this.channelsService.editChat(
      url,
      name,
      chatId,
      body.content,
      user.id,
    );
  }

  @ApiOperation({ summary: '채널 메시지 삭제 (작성자만, 답글도 함께 삭제)' })
  @Delete(':name/chats/:chatId')
  async deleteChat(
    @Param('url') url: string,
    @Param('name') name: string,
    @Param('chatId', ParseIntPipe) chatId: number,
    @User() user: Users,
  ) {
    await this.channelsService.deleteChat(url, name, chatId, user.id);
    return 'ok';
  }

  @ApiOperation({ summary: '스레드 답글 목록' })
  @Get(':name/chats/:chatId/replies')
  getReplies(
    @Param('url') url: string,
    @Param('name') name: string,
    @Param('chatId', ParseIntPipe) chatId: number,
    @User() user: Users,
  ) {
    return this.channelsService.getReplies(url, name, chatId, user.id);
  }

  @ApiOperation({ summary: '스레드 답글 작성' })
  @Post(':name/chats/:chatId/replies')
  postReply(
    @Param('url') url: string,
    @Param('name') name: string,
    @Param('chatId', ParseIntPipe) chatId: number,
    @Body() body: PostChatDto,
    @User() user: Users,
  ) {
    return this.channelsService.postReply(
      url,
      name,
      chatId,
      body.content,
      user.id,
    );
  }

  @ApiOperation({ summary: '이모지 리액션 토글 (있으면 취소, 없으면 추가)' })
  @Post(':name/chats/:chatId/reactions')
  toggleReaction(
    @Param('url') url: string,
    @Param('name') name: string,
    @Param('chatId', ParseIntPipe) chatId: number,
    @Body() body: ReactionDto,
    @User() user: Users,
  ) {
    return this.channelsService.toggleReaction(
      url,
      name,
      chatId,
      body.emoji,
      user.id,
    );
  }

  @ApiOperation({ summary: '메시지 고정' })
  @Post(':name/chats/:chatId/pin')
  pinChat(
    @Param('url') url: string,
    @Param('name') name: string,
    @Param('chatId', ParseIntPipe) chatId: number,
    @User() user: Users,
  ) {
    return this.channelsService.setPinned(url, name, chatId, true, user.id);
  }

  @ApiOperation({ summary: '메시지 고정 해제' })
  @Delete(':name/chats/:chatId/pin')
  unpinChat(
    @Param('url') url: string,
    @Param('name') name: string,
    @Param('chatId', ParseIntPipe) chatId: number,
    @User() user: Users,
  ) {
    return this.channelsService.setPinned(url, name, chatId, false, user.id);
  }

  @ApiOperation({ summary: '고정된 메시지 목록' })
  @Get(':name/pinned')
  getPinned(
    @Param('url') url: string,
    @Param('name') name: string,
    @User() user: Users,
  ) {
    return this.channelsService.getPinnedChats(url, name, user.id);
  }

  @ApiOperation({
    summary: '채널 파일 전송 (서버에 저장하지 않고 접속 중인 멤버에게 중계)',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('file', MAX_FILES, relayUploadOptions))
  @Post(':name/files')
  sendFiles(
    @Param('url') url: string,
    @Param('name') name: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body('ids') ids: string | string[],
    @User() user: Users,
  ) {
    return this.channelsService.sendChannelFiles(
      url,
      name,
      files || [],
      normalizeIds(ids),
      user.id,
    );
  }

  @ApiOperation({ summary: '채널 멤버 목록' })
  @Get(':name/members')
  getAllMembers(
    @Param('url') url: string,
    @Param('name') name: string,
    @User() user: Users,
  ) {
    return this.channelsService.getWorkspaceChannelMembers(url, name, user.id);
  }

  @ApiOperation({ summary: '채널 멤버 초대' })
  @Post(':name/members')
  async inviteMembers(
    @Param('url') url: string,
    @Param('name') name: string,
    @Body() body: InviteMemberDto,
    @User() user: Users,
  ) {
    await this.channelsService.createWorkspaceChannelMembers(
      url,
      name,
      body.email,
      user.id,
    );
    return 'ok';
  }

  @ApiOperation({ summary: '채널 나가기 (일반 채널 제외)' })
  @Delete(':name/members/me')
  async leaveChannel(
    @Param('url') url: string,
    @Param('name') name: string,
    @User() user: Users,
  ) {
    await this.channelsService.leaveChannel(url, name, user.id);
    return 'ok';
  }
}
