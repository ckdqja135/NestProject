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
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { LoggedInGuard } from '../auth/logged-in.guard';
import { User } from '../common/decorators/user.decorator';
import { PostChatDto } from '../common/dto/post-chat.dto';
import { imageUploadOptions } from '../common/upload';
import { Users } from '../entities/Users';
import { DmsService } from './dms.service';

@ApiTags('DM')
@ApiCookieAuth('connect.sid')
@UseGuards(LoggedInGuard)
@Controller('api/workspaces/:url/dms')
export class DmsController {
  constructor(private dmsService: DmsService) {}

  @ApiParam({ name: 'url', required: true, description: '워크스페이스 url' })
  @ApiParam({ name: 'id', required: true, description: '사용자 아이디' })
  @ApiQuery({
    name: 'perPage',
    required: false,
    description: '한 번에 가져오는 개수',
  })
  @ApiQuery({ name: 'page', required: false, description: '불러올 페이지' })
  @ApiOperation({ summary: 'DM 목록' })
  @Get(':id/chats')
  getChat(
    @Param('url') url: string,
    @Param('id', ParseIntPipe) id: number,
    @Query('perPage', new DefaultValuePipe(20), ParseIntPipe) perPage: number,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @User() user: Users,
  ) {
    return this.dmsService.getWorkspaceDMChats(url, id, user.id, perPage, page);
  }

  @ApiOperation({ summary: '안 읽은 DM 개수' })
  @ApiQuery({ name: 'after', required: false })
  @Get(':id/unreads')
  getUnreads(
    @Param('url') url: string,
    @Param('id', ParseIntPipe) id: number,
    @Query('after', new DefaultValuePipe(0), ParseIntPipe) after: number,
    @User() user: Users,
  ) {
    return this.dmsService.getDMUnreadsCount(url, id, user.id, after);
  }

  @ApiOperation({ summary: 'DM 전송 (저장된 메시지 반환)' })
  @Post(':id/chats')
  postChat(
    @Param('url') url: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PostChatDto,
    @User() user: Users,
  ) {
    return this.dmsService.createWorkspaceDMChats(
      url,
      body.content,
      id,
      user.id,
    );
  }

  @ApiOperation({ summary: 'DM 수정 (보낸 사람만)' })
  @Patch(':id/chats/:dmId')
  editChat(
    @Param('url') url: string,
    @Param('id', ParseIntPipe) id: number,
    @Param('dmId', ParseIntPipe) dmId: number,
    @Body() body: PostChatDto,
    @User() user: Users,
  ) {
    return this.dmsService.editDM(url, id, dmId, body.content, user.id);
  }

  @ApiOperation({ summary: 'DM 삭제 (보낸 사람만)' })
  @Delete(':id/chats/:dmId')
  async deleteChat(
    @Param('url') url: string,
    @Param('id', ParseIntPipe) id: number,
    @Param('dmId', ParseIntPipe) dmId: number,
    @User() user: Users,
  ) {
    await this.dmsService.deleteDM(url, id, dmId, user.id);
    return 'ok';
  }

  @ApiOperation({ summary: 'DM 이미지 전송' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('image', 10, imageUploadOptions))
  @Post(':id/images')
  async postImages(
    @Param('url') url: string,
    @Param('id', ParseIntPipe) id: number,
    @UploadedFiles() files: Express.Multer.File[],
    @User() user: Users,
  ) {
    await this.dmsService.createWorkspaceDMImages(
      url,
      files || [],
      id,
      user.id,
    );
    return 'ok';
  }
}
