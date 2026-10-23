import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LoggedInGuard } from '../auth/logged-in.guard';
import { User } from '../common/decorators/user.decorator';
import { Users } from '../entities/Users';
import {
  CreateDocDto,
  DocCommentDto,
  DocListQuery,
  EditDocCommentDto,
  ResolveThreadDto,
  DocSettingsDto,
  DocShareDto,
  FolderDto,
  UpdateDocDto,
  DocChannelShareDto,
  DocAccessRequestDto,
  DocAccessDecisionDto,
} from './dto/docs.dto';
import { DocsService } from './docs.service';

@ApiTags('DOCS')
@ApiCookieAuth('connect.sid')
@UseGuards(LoggedInGuard)
@Controller('api/workspaces/:url')
export class DocsController {
  constructor(private docsService: DocsService) {}

  @ApiOperation({
    summary: '문서 목록 (최근·내 소유·나와 공유·즐겨찾기·휴지통·폴더)',
  })
  @Get('docs')
  listDocs(
    @Param('url') url: string,
    @Query() query: DocListQuery,
    @User() user: Users,
  ) {
    return this.docsService.listDocs(url, query, user.id);
  }

  @ApiOperation({ summary: '위키 페이지 트리' })
  @Get('docs/wiki')
  getWikiTree(@Param('url') url: string, @User() user: Users) {
    return this.docsService.getWikiTree(url, user.id);
  }

  @ApiOperation({ summary: '문서 보기 (내 권한 포함, 최근 목록에 기록)' })
  @Get('docs/:id')
  getDoc(
    @Param('url') url: string,
    @Param('id', ParseIntPipe) id: number,
    @User() user: Users,
  ) {
    return this.docsService.getDoc(url, id, user.id);
  }

  @ApiOperation({ summary: '문서 만들기 (문서·위키·슬라이드)' })
  @Post('docs')
  createDoc(
    @Param('url') url: string,
    @Body() body: CreateDocDto,
    @User() user: Users,
  ) {
    return this.docsService.createDoc(url, body, user.id);
  }

  @ApiOperation({ summary: '문서 저장 (version 이 다르면 409)' })
  @Patch('docs/:id')
  updateDoc(
    @Param('url') url: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateDocDto,
    @User() user: Users,
  ) {
    return this.docsService.updateDoc(url, id, body, user.id);
  }

  @ApiOperation({ summary: '공개 범위·폴더·상위 페이지 바꾸기' })
  @Patch('docs/:id/settings')
  updateSettings(
    @Param('url') url: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: DocSettingsDto,
    @User() user: Users,
  ) {
    return this.docsService.updateSettings(url, id, body, user.id);
  }

  @ApiOperation({ summary: '사람과 공유 (보기·편집)' })
  @Put('docs/:id/shares')
  async setShare(
    @Param('url') url: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: DocShareDto,
    @User() user: Users,
  ) {
    await this.docsService.setShare(url, id, body.userId, body.role, user.id);
    return 'ok';
  }

  @ApiOperation({ summary: '채널 사람들 모두에게 보기 권한 주기' })
  @Put('docs/:id/channel-share')
  shareWithChannel(
    @Param('url') url: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: DocChannelShareDto,
    @User() user: Users,
  ) {
    return this.docsService.shareWithChannel(url, id, body.channel, user.id);
  }

  @ApiOperation({ summary: '공유 해제' })
  @Delete('docs/:id/shares/:userId')
  async removeShare(
    @Param('url') url: string,
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number,
    @User() user: Users,
  ) {
    await this.docsService.removeShare(url, id, userId, user.id);
    return 'ok';
  }

  @ApiOperation({
    summary: '접근 요청 (권한이 없는 문서를 링크로 열었을 때 주인에게)',
  })
  @Post('docs/:id/access-requests')
  requestAccess(
    @Param('url') url: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: DocAccessRequestDto,
    @User() user: Users,
  ) {
    return this.docsService.requestAccess(url, id, body, user.id);
  }

  @ApiOperation({ summary: '기다리는 접근 요청 (문서 주인·관리자)' })
  @Get('docs/:id/access-requests')
  listAccessRequests(
    @Param('url') url: string,
    @Param('id', ParseIntPipe) id: number,
    @User() user: Users,
  ) {
    return this.docsService.listAccessRequests(url, id, user.id);
  }

  @ApiOperation({ summary: '접근 요청 허락·거절 (문서 주인·관리자)' })
  @Post('docs/:id/access-requests/:requestId')
  decideAccessRequest(
    @Param('url') url: string,
    @Param('id', ParseIntPipe) id: number,
    @Param('requestId', ParseIntPipe) requestId: number,
    @Body() body: DocAccessDecisionDto,
    @User() user: Users,
  ) {
    return this.docsService.decideAccessRequest(
      url,
      id,
      requestId,
      body,
      user.id,
    );
  }

  @ApiOperation({ summary: '즐겨찾기(고정)' })
  @Put('docs/:id/favorite')
  async favorite(
    @Param('url') url: string,
    @Param('id', ParseIntPipe) id: number,
    @User() user: Users,
  ) {
    await this.docsService.setFavorite(url, id, true, user.id);
    return 'ok';
  }

  @ApiOperation({ summary: '즐겨찾기 해제' })
  @Delete('docs/:id/favorite')
  async unfavorite(
    @Param('url') url: string,
    @Param('id', ParseIntPipe) id: number,
    @User() user: Users,
  ) {
    await this.docsService.setFavorite(url, id, false, user.id);
    return 'ok';
  }

  @ApiOperation({ summary: '휴지통으로' })
  @Delete('docs/:id')
  async trash(
    @Param('url') url: string,
    @Param('id', ParseIntPipe) id: number,
    @User() user: Users,
  ) {
    await this.docsService.trashDoc(url, id, user.id);
    return 'ok';
  }

  @ApiOperation({ summary: '휴지통에서 되살리기' })
  @Post('docs/:id/restore')
  async restore(
    @Param('url') url: string,
    @Param('id', ParseIntPipe) id: number,
    @User() user: Users,
  ) {
    await this.docsService.restoreDoc(url, id, user.id);
    return 'ok';
  }

  @ApiOperation({ summary: '영구 삭제 (휴지통에 있는 내 문서)' })
  @Delete('docs/:id/permanent')
  async deleteForever(
    @Param('url') url: string,
    @Param('id', ParseIntPipe) id: number,
    @User() user: Users,
  ) {
    await this.docsService.deleteForever(url, id, user.id);
    return 'ok';
  }

  @ApiOperation({ summary: '내 폴더 목록' })
  @Get('doc-folders')
  getFolders(@Param('url') url: string, @User() user: Users) {
    return this.docsService.getFolders(url, user.id);
  }

  @ApiOperation({ summary: '폴더 만들기' })
  @Post('doc-folders')
  createFolder(
    @Param('url') url: string,
    @Body() body: FolderDto,
    @User() user: Users,
  ) {
    return this.docsService.createFolder(
      url,
      body.name || '',
      body.parentId || null,
      user.id,
    );
  }

  @ApiOperation({ summary: '폴더 이름 바꾸기·옮기기' })
  @Patch('doc-folders/:id')
  updateFolder(
    @Param('url') url: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: FolderDto,
    @User() user: Users,
  ) {
    return this.docsService.updateFolder(url, id, body, user.id);
  }

  @ApiOperation({ summary: '폴더 삭제 (안의 문서는 폴더 밖으로)' })
  @Delete('doc-folders/:id')
  async deleteFolder(
    @Param('url') url: string,
    @Param('id', ParseIntPipe) id: number,
    @User() user: Users,
  ) {
    await this.docsService.deleteFolder(url, id, user.id);
    return 'ok';
  }

  @ApiOperation({ summary: '문서 제목만 (페이지 링크 표시용)' })
  @Get('docs/:id/title')
  title(
    @Param('url') url: string,
    @Param('id', ParseIntPipe) id: number,
    @User() user: Users,
  ) {
    return this.docsService.getDocTitle(url, id, user.id);
  }

  @ApiOperation({ summary: '이 문서를 링크한 문서들 (백링크)' })
  @Get('docs/:id/backlinks')
  backlinks(
    @Param('url') url: string,
    @Param('id', ParseIntPipe) id: number,
    @User() user: Users,
  ) {
    return this.docsService.getBacklinks(url, id, user.id);
  }

  @ApiOperation({ summary: '문서 댓글 (스레드별로 묶어 보여 준다)' })
  @Get('docs/:id/comments')
  comments(
    @Param('url') url: string,
    @Param('id', ParseIntPipe) id: number,
    @User() user: Users,
  ) {
    return this.docsService.listComments(url, id, user.id);
  }

  @ApiOperation({ summary: '댓글 달기 (새 스레드 또는 답글)' })
  @Post('docs/:id/comments')
  addComment(
    @Param('url') url: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: DocCommentDto,
    @User() user: Users,
  ) {
    return this.docsService.addComment(url, id, body, user.id);
  }

  @ApiOperation({ summary: '내 댓글 고치기' })
  @Patch('docs/:id/comments/:commentId')
  async editComment(
    @Param('url') url: string,
    @Param('id', ParseIntPipe) id: number,
    @Param('commentId', ParseIntPipe) commentId: number,
    @Body() body: EditDocCommentDto,
    @User() user: Users,
  ) {
    await this.docsService.editComment(
      url,
      id,
      commentId,
      body.content,
      user.id,
    );
    return 'ok';
  }

  @ApiOperation({ summary: '댓글 지우기 (내 댓글, 문서 주인·관리자는 모두)' })
  @Delete('docs/:id/comments/:commentId')
  async deleteComment(
    @Param('url') url: string,
    @Param('id', ParseIntPipe) id: number,
    @Param('commentId', ParseIntPipe) commentId: number,
    @User() user: Users,
  ) {
    await this.docsService.deleteComment(url, id, commentId, user.id);
    return 'ok';
  }

  @ApiOperation({ summary: '스레드 해결함 / 다시 열기' })
  @Put('docs/:id/comment-threads/:threadId')
  async resolveThread(
    @Param('url') url: string,
    @Param('id', ParseIntPipe) id: number,
    @Param('threadId') threadId: string,
    @Body() body: ResolveThreadDto,
    @User() user: Users,
  ) {
    await this.docsService.resolveThread(
      url,
      id,
      threadId,
      body.resolved,
      user.id,
    );
    return 'ok';
  }
}
