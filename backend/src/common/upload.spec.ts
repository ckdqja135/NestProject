import { normalizeIds, toFileContent, toFileMeta } from './upload';

const file = (originalname: string, extra: Partial<Express.Multer.File> = {}) =>
  ({
    originalname,
    mimetype: 'application/pdf',
    size: 1234,
    ...extra,
  }) as Express.Multer.File;

describe('파일 중계 업로드', () => {
  it('보낸 사람이 정한 id(UUID) 를 그대로 쓴다', () => {
    const id = '3f2b8c1e-1a2b-4c3d-8e9f-0123456789ab';
    expect(toFileMeta(file('a.pdf'), id).id).toBe(id);
  });

  it('id 가 없거나 형식이 틀리면 새 UUID 를 만든다', () => {
    expect(toFileMeta(file('a.pdf')).id).toMatch(/^[0-9a-f-]{36}$/);
    expect(toFileMeta(file('a.pdf'), '../../etc').id).not.toBe('../../etc');
  });

  it('multer 가 latin1 로 읽은 한글 파일명을 복원한다', () => {
    const latin1 = Buffer.from('회의록.pdf', 'utf8').toString('latin1');
    expect(toFileMeta(file(latin1)).name).toBe('회의록.pdf');
  });

  it('채팅 본문에는 파일 정보만 JSON 으로 담는다', () => {
    const meta = toFileMeta(
      file('a.pdf'),
      '3f2b8c1e-1a2b-4c3d-8e9f-0123456789ab',
    );
    expect(toFileContent(meta)).toBe(
      'file:{"id":"3f2b8c1e-1a2b-4c3d-8e9f-0123456789ab","name":"a.pdf","type":"application/pdf","size":1234}',
    );
  });

  it('ids 필드는 문자열 하나 또는 배열로 올 수 있다', () => {
    expect(normalizeIds('x')).toEqual(['x']);
    expect(normalizeIds(['x', 'y'])).toEqual(['x', 'y']);
    expect(normalizeIds(undefined)).toEqual([]);
  });
});
