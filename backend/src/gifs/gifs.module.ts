import { Module } from '@nestjs/common';
import { GifsController } from './gifs.controller';
import { GifsService } from './gifs.service';

@Module({
  providers: [GifsService],
  controllers: [GifsController],
})
export class GifsModule {}
