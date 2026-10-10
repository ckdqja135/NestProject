import { putFile } from '@utils/fileStore';
import getErrorMessage from '@utils/getErrorMessage';
import axios from 'axios';
import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';

const MAX_SIZE = 20 * 1024 * 1024; // 서버 제한과 동일 (20MB)
const MAX_FILES = 10;

const uuid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

// 파일 보내기: 내 기기 저장소에 먼저 보관한 뒤 서버로 보낸다.
// 서버는 파일을 저장하지 않고 접속 중인 상대에게 중계만 한다.
const useFileUpload = (url: string, onSuccess?: () => void) => {
  const [uploading, setUploading] = useState(false);

  const upload = useCallback(
    async (files: File[]) => {
      const tooLarge = files.filter((file) => file.size > MAX_SIZE);
      if (tooLarge.length) {
        toast.error(`20MB 이하 파일만 보낼 수 있습니다. (${tooLarge.map((f) => f.name).join(', ')})`, {
          position: 'bottom-center',
        });
      }
      const valid = files.filter((file) => file.size <= MAX_SIZE).slice(0, MAX_FILES);
      if (!valid.length) {
        return;
      }
      setUploading(true);
      try {
        const formData = new FormData();
        for (const file of valid) {
          const id = uuid();
          await putFile({ id, name: file.name, type: file.type || 'application/octet-stream', size: file.size }, file);
          formData.append('file', file);
          formData.append('ids', id);
        }
        await axios.post(url, formData);
        onSuccess?.();
      } catch (error: any) {
        const message = error?.response?.status === 413 ? '20MB 이하 파일만 보낼 수 있습니다.' : getErrorMessage(error);
        toast.error(message, { position: 'bottom-center' });
      } finally {
        setUploading(false);
      }
    },
    [url, onSuccess],
  );

  return { upload, uploading };
};

export default useFileUpload;
