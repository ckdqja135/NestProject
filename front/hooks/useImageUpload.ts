import getErrorMessage from '@utils/getErrorMessage';
import axios from 'axios';
import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';

export const ACCEPT_IMAGES = 'image/png,image/jpeg,image/gif,image/webp';
const ALLOWED = ACCEPT_IMAGES.split(',');
const MAX_SIZE = 20 * 1024 * 1024; // 서버 제한과 동일 (20MB)
const MAX_FILES = 10;

// 이미지(GIF 포함) 업로드. 형식/크기를 먼저 확인하고 실패하면 토스트로 알린다.
const useImageUpload = (url: string, onSuccess?: () => void) => {
  const [uploading, setUploading] = useState(false);

  const upload = useCallback(
    (files: File[]) => {
      const images = files.filter((file) => ALLOWED.includes(file.type));
      if (images.length < files.length) {
        toast.error('JPG, PNG, GIF, WebP 이미지만 업로드할 수 있습니다.', { position: 'bottom-center' });
      }
      const tooLarge = images.filter((file) => file.size > MAX_SIZE);
      if (tooLarge.length) {
        toast.error(`20MB 이하 이미지만 업로드할 수 있습니다. (${tooLarge.map((f) => f.name).join(', ')})`, {
          position: 'bottom-center',
        });
      }
      const valid = images.filter((file) => file.size <= MAX_SIZE).slice(0, MAX_FILES);
      if (!valid.length) {
        return;
      }
      const formData = new FormData();
      valid.forEach((file) => formData.append('image', file));
      setUploading(true);
      axios
        .post(url, formData)
        .then(() => onSuccess?.())
        .catch((error) => {
          const message =
            error?.response?.status === 413 ? '20MB 이하 이미지만 업로드할 수 있습니다.' : getErrorMessage(error);
          toast.error(message, { position: 'bottom-center' });
        })
        .finally(() => setUploading(false));
    },
    [url, onSuccess],
  );

  return { upload, uploading };
};

export default useImageUpload;
