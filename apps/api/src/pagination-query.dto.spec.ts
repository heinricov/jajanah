import { ArgumentMetadata, ValidationPipe } from '@nestjs/common';
import { PaginationQueryDto } from '@packages/validators';

describe('PaginationQueryDto (request contract)', () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true });

  const metadata = (metatype: unknown): ArgumentMetadata => ({
    type: 'query',
    metatype: metatype as never,
  });

  it('transforms string query params into numbers', async () => {
    const dto = await pipe.transform({ page: '2', limit: '10' }, metadata(PaginationQueryDto));

    expect(dto).toEqual({ page: 2, limit: 10 });
  });

  it('drops unknown keys (whitelist)', async () => {
    const dto = await pipe.transform({ page: '1', hack: 'x' }, metadata(PaginationQueryDto));

    expect(dto).toEqual({ page: 1 });
  });

  it('rejects values outside the contract', async () => {
    await expect(pipe.transform({ page: '0' }, metadata(PaginationQueryDto))).rejects.toMatchObject(
      { status: 400 },
    );

    await expect(
      pipe.transform({ limit: '999' }, metadata(PaginationQueryDto)),
    ).rejects.toMatchObject({ status: 400 });
  });
});
