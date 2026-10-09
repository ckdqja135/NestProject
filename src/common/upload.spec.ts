import { BadRequestException } from '@nestjs/common';
import { imageUploadOptions } from './upload';

const runFilter = (mimetype: string) =>
  new Promise<{ error: Error | null; accepted: boolean }>((resolve) => {
    imageUploadOptions.fileFilter(
      {} as any,
      { mimetype } as Express.Multer.File,
      (error: Error | null, accepted?: boolean) =>
        resolve({ error, accepted: !!accepted }),
    );
  });

describe('imageUploadOptions', () => {
  it.each(['image/gif', 'image/png', 'image/jpeg', 'image/webp'])(
    '%s 는 허용한다',
    async (mimetype) => {
      await expect(runFilter(mimetype)).resolves.toEqual({
        error: null,
        accepted: true,
      });
    },
  );

  it.each(['image/svg+xml', 'text/html', 'application/pdf'])(
    '%s 는 거부한다',
    async (mimetype) => {
      const { error, accepted } = await runFilter(mimetype);
      expect(accepted).toBe(false);
      expect(error).toBeInstanceOf(BadRequestException);
    },
  );
});
