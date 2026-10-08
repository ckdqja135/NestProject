import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
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
import { imageUploadOptions } from '../common/upload';
import { Users } from '../entities/Users';
import { ChannelsService } from './channels.service';
import { CreateChannelDto } from './dto/create-channel.dto';

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
    return this.channelsService.createWorkspaceChannel(url, body.name, user.id);
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
  @Get(':name/chats')
  getChats(
    @Param('url') url: string,
    @Param('name') name: string,
    @Query('perPage', new DefaultValuePipe(20), ParseIntPipe) perPage: number,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @User() user: Users,
  ) {
    return this.channelsService.getWorkspaceChannelChats(
      url,
      name,
      perPage,
      page,
      user.id,
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

  @ApiOperation({ summary: '채널 채팅 전송' })
  @Post(':name/chats')
  async postChat(
    @Param('url') url: string,
    @Param('name') name: string,
    @Body() body: PostChatDto,
    @User() user: Users,
  ) {
    await this.channelsService.postChat(url, name, body.content, user.id);
    return 'ok';
  }

  @ApiOperation({ summary: '채널 이미지 전송' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('image', 10, imageUploadOptions))
  @Post(':name/images')
  async postImages(
    @Param('url') url: string,
    @Param('name') name: string,
    @UploadedFiles() files: Express.Multer.File[],
    @User() user: Users,
  ) {
    await this.channelsService.createWorkspaceChannelImages(
      url,
      name,
      files || [],
      user.id,
    );
    return 'ok';
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
}
