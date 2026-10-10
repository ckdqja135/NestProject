import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LoggedInGuard } from '../auth/logged-in.guard';
import { User } from '../common/decorators/user.decorator';
import { Users } from '../entities/Users';
import { SearchService } from './search.service';
import { SearchQueryDto } from './dto/search-query.dto';

@ApiTags('SEARCH')
@ApiCookieAuth('connect.sid')
@UseGuards(LoggedInGuard)
@Controller('api/workspaces/:url/search')
export class SearchController {
  constructor(private searchService: SearchService) {}

  @ApiOperation({
    summary:
      '워크스페이스 메시지 검색 (채널 + DM). 채널·보낸 사람·기간 필터, 30개씩 페이지',
  })
  @Get()
  search(
    @Param('url') url: string,
    @Query() query: SearchQueryDto,
    @User() user: Users,
  ) {
    return this.searchService.search(url, query, user.id);
  }
}
