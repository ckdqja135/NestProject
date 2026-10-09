import { BadRequestException } from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { randomBytes } from 'crypto';
import multer from 'multer';

// 업로드 허용 형식. SVG 는 스크립트를 담을 수 있어(XSS) 허용하지 않는다.
export const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
};
export const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20MB (움직이는 GIF 고려)

export const imageUploadOptions: MulterOptions = {
  storage: multer.diskStorage({
    destination(req, file, cb) {
      cb(null, 'uploads/');
    },
    // 원본 파일명은 한글이 깨지거나 경로 문자가 섞일 수 있어 쓰지 않는다
    filename(req, file, cb) {
      const ext = IMAGE_EXTENSIONS[file.mimetype];
      cb(null, `${Date.now()}-${randomBytes(6).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: MAX_IMAGE_SIZE, files: 10 },
  fileFilter(req, file, cb) {
    if (!IMAGE_EXTENSIONS[file.mimetype]) {
      return cb(
        new BadRequestException(
          'JPG, PNG, GIF, WebP 이미지만 업로드할 수 있습니다.',
        ),
        false,
      );
    }
    cb(null, true);
  },
};
