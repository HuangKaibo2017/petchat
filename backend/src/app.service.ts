import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      status: 'ok',
      framework: 'NestJS',
      time: new Date().toISOString(),
    };
  }
}
