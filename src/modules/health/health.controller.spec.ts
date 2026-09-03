import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('reports ready only when the required project schema is queryable', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([]) };
    const controller = new HealthController(prisma as never);

    await expect(controller.ready()).resolves.toEqual({
      status: 'ready',
      database: 'ok',
      schema: 'compatible',
    });
  });

  it('reports unavailable when connectivity or the required schema check fails', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockRejectedValue(new Error('schema mismatch')),
    };
    const controller = new HealthController(prisma as never);

    await expect(controller.ready()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
