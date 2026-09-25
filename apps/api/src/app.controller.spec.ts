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

  it('should return the status payload', () => {
    const result = controller.getStatus();

    expect(result).toEqual(expect.objectContaining({ service: 'api', status: 'ok' }));
    expect(typeof result.mode).toBe('string');
  });
});
