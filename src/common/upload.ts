import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { randomUUID } from 'crypto';
import multer from 'multer';

export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
export const MAX_FILES = 10;

// 파일은 서버 디스크에 저장하지 않는다. 메모리로만 받아서 접속 중인 상대에게 중계하고 버린다.
export const relayUploadOptions: MulterOptions = {
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES },
};

// 채팅에는 파일 내용 대신 이 정보만 남는다 (본문: `file:{...}`)
export interface FileMeta {
  id: string;
  name: string;
  type: string;
  size: number;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// multer 는 파일명을 latin1 로 읽으므로 UTF-8 (한글 등) 로 복원한다
const decodeFileName = (name: string) =>
  Buffer.from(name, 'latin1').toString('utf8');

// 보낸 사람이 자기 기기에 먼저 저장할 때 쓴 id 를 그대로 쓰고, 없거나 형식이 틀리면 새로 만든다
export function toFileMeta(
  file: Express.Multer.File,
  clientId?: string,
): FileMeta {
  return {
    id: clientId && UUID_PATTERN.test(clientId) ? clientId : randomUUID(),
    name: decodeFileName(file.originalname).slice(0, 200),
    type: file.mimetype || 'application/octet-stream',
    size: file.size,
  };
}

export const toFileContent = (meta: FileMeta) => `file:${JSON.stringify(meta)}`;

// multipart 의 ids 필드 (하나면 문자열, 여러 개면 배열)
export const normalizeIds = (ids: string | string[] | undefined) =>
  Array.isArray(ids) ? ids : ids ? [ids] : [];
