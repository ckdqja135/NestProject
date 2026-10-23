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
import {
  ChangePasswordDto,
  RequestPasswordResetDto,
  ResetPasswordDto,
  UpdatePreferencesDto,
  UpdateProfileDto,
} from './dto/update-profile.dto';
import { Throttle } from '@nestjs/throttler';
import { authRateLimitPerMinute } from '../security';
import { UsersService } from './users.service';
import { PasswordResetService } from './password-reset.service';
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
  constructor(
    private usersService: UsersService,
    private passwordResetService: PasswordResetService,
  ) {}

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
  // 회원가입·로그인·비밀번호 변경은 1분에 몇 번만 (비밀번호 대입 방지)
  @Throttle({ default: { limit: authRateLimitPerMinute, ttl: 60_000 } })
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
  @Throttle({ default: { limit: authRateLimitPerMinute, ttl: 60_000 } })
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
  @ApiOperation({ summary: '내 프로필 수정 (닉네임, 아바타 스타일, 상태)' })
  @Patch('me')
  updateProfile(@User() user, @Body() body: UpdateProfileDto) {
    return this.usersService.updateProfile(user.id, body);
  }

  @UseGuards(LoggedInGuard)
  @ApiOperation({
    summary: '내 설정 (화면 테마, 알림 일시 중지) — 모든 기기에 적용',
  })
  @Patch('me/preferences')
  updatePreferences(@User() user, @Body() body: UpdatePreferencesDto) {
    return this.usersService.updatePreferences(user.id, body);
  }

  // 비밀번호 찾기: 가입한 이메일인지와 상관없이 같은 응답 (가입 여부를 알아낼 수 없게)
  @ApiOperation({ summary: '비밀번호 재설정 메일 보내기' })
  @Throttle({ default: { limit: authRateLimitPerMinute, ttl: 60_000 } })
  @Post('password-reset')
  async requestPasswordReset(@Body() body: RequestPasswordResetDto) {
    await this.passwordResetService.request(body.email);
    return 'ok';
  }

  @ApiOperation({ summary: '메일로 받은 링크로 새 비밀번호 정하기' })
  @Throttle({ default: { limit: authRateLimitPerMinute, ttl: 60_000 } })
  @Post('password-reset/confirm')
  async resetPassword(@Body() body: ResetPasswordDto) {
    await this.passwordResetService.reset(body.token, body.password);
    return 'ok';
  }

  @UseGuards(LoggedInGuard)
  @ApiOperation({ summary: '비밀번호 변경' })
  @Throttle({ default: { limit: authRateLimitPerMinute, ttl: 60_000 } })
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
