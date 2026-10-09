import {
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { LoggedInGuard } from '../auth/logged-in.guard';
import { GifsService } from './gifs.service';

@ApiTags('GIF')
@ApiCookieAuth('connect.sid')
@UseGuards(LoggedInGuard)
@Controller('api/gifs')
export class GifsController {
  constructor(private gifsService: GifsService) {}

  @ApiOperation({ summary: 'GIF 검색 사용 가능 여부' })
  @Get('status')
  status() {
    return { enabled: this.gifsService.isEnabled() };
  }

  @ApiOperation({ summary: 'GIF 검색 (GIPHY, 검색어가 없으면 인기 GIF)' })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'offset', required: false })
  @Get()
  search(
    @Query('q') q: string,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    return this.gifsService.search(q, offset);
  }
}
