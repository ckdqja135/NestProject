import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiConsumes,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { LoggedInGuard } from '../auth/logged-in.guard';
import { User } from '../common/decorators/user.decorator';
import { relayUploadOptions } from '../common/upload';
import { Users } from '../entities/Users';
import { FilesService } from './files.service';

@ApiTags('FILE')
@ApiCookieAuth('connect.sid')
@UseGuards(LoggedInGuard)
@Controller('api/workspaces/:url/files')
export class FilesController {
  constructor(private filesService: FilesService) {}

  @ApiOperation({
    summary:
      '받지 못한 사람에게 파일 다시 보내기 (보낸 사람만, 서버에 저장하지 않고 중계)',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', relayUploadOptions))
  @Post('relay')
  async relay(
    @Param('url') url: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('fileId') fileId: string,
    @Body('requesterId', ParseIntPipe) requesterId: number,
    @User() user: Users,
  ) {
    await this.filesService.relayToRequester(
      url,
      user.id,
      fileId,
      requesterId,
      file,
    );
    return 'ok';
  }
}
