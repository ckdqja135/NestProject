import {
  Body,
  Controller,
  Patch,
  Post,
  Get,
  Req,
  Res,
  UseInterceptors,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JoinRequestDto } from './dto/join.request.dto';
import { ChangePasswordDto, UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';
import { UserDto } from '../common/dto/user.dto';
import { User } from '../common/decorators/user.decorator';
import { UndefinedToNullInterceptor } from '../common/interceptors/undefinedToNull.interceptor';
import { LocalAuthGuard } from '../auth/local-auth.guard';
import { LoggedInGuard } from '../auth/logged-in.guard';
import { NotLoggedInGuard } from '../auth/not-logged-in.guard';

@UseInterceptors(UndefinedToNullInterceptor)
@ApiTags('USER')
@Controller('api/users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @ApiResponse({
    type: UserDto,
    status: 200,
    description: '성공',
  })
  @ApiOperation({ summary: '내 정보 조회 (로그인하지 않았으면 false)' })
  @Get()
  getUsers(@User() user) {
    return user || false;
  }

  @UseGuards(NotLoggedInGuard)
  @ApiOperation({ summary: '회원가입' })
  @Post()
  async join(@Body() body: JoinRequestDto) {
    await this.usersService.join(body.email, body.nickname, body.password);
    return 'ok';
  }

  @ApiResponse({
    type: UserDto,
    status: 200,
    description: '성공',
  })
  @ApiResponse({
    status: 500,
    description: '서버 에러',
  })
  @ApiOperation({ summary: '로그인' })
  @UseGuards(LocalAuthGuard)
  @Post('login')
  logIn(@User() user) {
    return user;
  }

  @UseGuards(LoggedInGuard)
  @ApiOperation({ summary: '로그아웃' })
  @Post('logout')
  logOut(@Req() req, @Res() res) {
    req.logOut((err) => {
      if (err) {
        return res.status(500).send(err.message);
      }
      req.session.destroy(() => {
        res.clearCookie('connect.sid', { httpOnly: true });
        res.send('ok');
      });
    });
  }

  @UseGuards(LoggedInGuard)
  @ApiOperation({ summary: '내 프로필 수정 (닉네임, 아바타 스타일)' })
  @Patch('me')
  updateProfile(@User() user, @Body() body: UpdateProfileDto) {
    return this.usersService.updateProfile(user.id, body);
  }

  @UseGuards(LoggedInGuard)
  @ApiOperation({ summary: '비밀번호 변경' })
  @Post('me/password')
  async changePassword(@User() user, @Body() body: ChangePasswordDto) {
    await this.usersService.changePassword(
      user.id,
      body.currentPassword,
      body.newPassword,
    );
    return 'ok';
  }
}
