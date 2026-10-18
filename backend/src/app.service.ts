import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppService {
  constructor(private configService: ConfigService) {}

  getHello() {
    return `Shlack API server (env: ${
      this.configService.get('NODE_ENV') || 'development'
    })`;
  }
}
