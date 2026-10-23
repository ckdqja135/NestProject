import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { LoggedInGuard } from '../auth/logged-in.guard';
import { User } from '../common/decorators/user.decorator';
import { Users } from '../entities/Users';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { LinksService } from './links.service';

const MAX_URL = 2000;

@ApiTags('LINKS')
@ApiCookieAuth('connect.sid')
@UseGuards(LoggedInGuard)
@Controller('api')
export class LinksController {
  constructor(
    private linksService: LinksService,
    private workspacesService: WorkspacesService,
  ) {}

  @ApiOperation({
    summary: '링크 미리보기 (제목·설명·그림). 내부 주소는 열지 않는다',
  })
  @Get('workspaces/:url/link-preview')
  async preview(
    @Param('url') workspaceUrl: string,
    @Query('url') url: string,
    @User() user: Users,
  ) {
    if (!url || url.length > MAX_URL) {
      throw new BadRequestException('주소가 올바르지 않습니다.');
    }
    const workspace =
      await this.workspacesService.findWorkspaceByUrl(workspaceUrl);
    await this.workspacesService.assertMember(workspace.id, user.id);
    return { preview: await this.linksService.preview(url) };
  }

  @ApiOperation({
    summary: '미리보기 그림 (서명한 주소만, 우리 서버를 거쳐 보여 준다)',
  })
  @Get('link-image')
  async image(
    @Query('u') url: string,
    @Query('s') signature: string,
    @Res() res: Response,
  ) {
    if (!url || url.length > MAX_URL) {
      throw new BadRequestException('주소가 올바르지 않습니다.');
    }
    if (!this.linksService.verify(url, signature)) {
      throw new ForbiddenException('서명이 올바르지 않습니다.');
    }
    let image;
    try {
      image = await this.linksService.image(url);
    } catch {
      throw new NotFoundException('그림을 가져오지 못했습니다.');
    }
    res.set({
      'Content-Type': image.contentType.split(';')[0],
      'Cache-Control': 'private, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'",
    });
    res.send(image.body);
  }
}
