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
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LoggedInGuard } from '../auth/logged-in.guard';
import { User } from '../common/decorators/user.decorator';
import { Users } from '../entities/Users';
import { ContactsService } from './contacts.service';
import { CreateContactDto, UpdateContactDto } from './dto/contact.dto';

@ApiTags('CONTACTS')
@ApiCookieAuth('connect.sid')
@UseGuards(LoggedInGuard)
@Controller('api/workspaces/:url/contacts')
export class ContactsController {
  constructor(private contactsService: ContactsService) {}

  @ApiOperation({ summary: '내 외부 연락처 목록 (이름순)' })
  @Get()
  list(@Param('url') url: string, @User() user: Users) {
    return this.contactsService.list(url, user.id);
  }

  @ApiOperation({ summary: '별표한 동료 id 목록' })
  @Get('stars')
  stars(@Param('url') url: string, @User() user: Users) {
    return this.contactsService.stars(url, user.id);
  }

  @ApiOperation({ summary: '동료에게 별표' })
  @Put('stars/:userId')
  async star(
    @Param('url') url: string,
    @Param('userId', ParseIntPipe) userId: number,
    @User() user: Users,
  ) {
    await this.contactsService.setStar(url, userId, true, user.id);
    return 'ok';
  }

  @ApiOperation({ summary: '동료 별표 빼기' })
  @Delete('stars/:userId')
  async unstar(
    @Param('url') url: string,
    @Param('userId', ParseIntPipe) userId: number,
    @User() user: Users,
  ) {
    await this.contactsService.setStar(url, userId, false, user.id);
    return 'ok';
  }

  @ApiOperation({ summary: '외부 연락처 추가' })
  @Post()
  create(
    @Param('url') url: string,
    @Body() body: CreateContactDto,
    @User() user: Users,
  ) {
    return this.contactsService.create(url, body, user.id);
  }

  @ApiOperation({ summary: '외부 연락처 고치기 (별표 포함)' })
  @Patch(':id')
  update(
    @Param('url') url: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateContactDto,
    @User() user: Users,
  ) {
    return this.contactsService.update(url, id, body, user.id);
  }

  @ApiOperation({ summary: '외부 연락처 지우기' })
  @Delete(':id')
  async remove(
    @Param('url') url: string,
    @Param('id', ParseIntPipe) id: number,
    @User() user: Users,
  ) {
    await this.contactsService.remove(url, id, user.id);
    return 'ok';
  }
}
