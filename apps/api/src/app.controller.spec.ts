import { Test } from '@nestjs/testing';

import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let controller: AppController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    controller = moduleRef.get(AppController);
  });

  it('should return the envelope status payload', () => {
    const result = controller.getStatus();

    expect(result.data.service).toBe('api');
    expect(result.data.status).toBe('ok');
    expect(typeof result.data.mode).toBe('string');
  });
});
