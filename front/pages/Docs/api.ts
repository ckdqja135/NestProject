import useSocket from '@hooks/useSocket';
import getErrorMessage from '@utils/getErrorMessage';
import axios from 'axios';
import { useEffect } from 'react';
import { toast } from 'react-toastify';

export const docsBase = (workspace: string) => `/api/workspaces/${workspace}`;
export const docPath = (workspace: string, id: number) => `/workspace/${workspace}/docs/d/${id}`;

export interface NewDocBody {
  type: 'doc' | 'wiki' | 'slides' | 'sheet' | 'board' | 'database';
  title?: string;
  content?: string;
  folderId?: number;
  parentId?: number;
}

// 새 문서를 만들고 편집 화면으로 간다
export const createDoc = (workspace: string, body: NewDocBody, go: (path: string) => void) =>
  axios
    .post<{ id: number }>(`${docsBase(workspace)}/docs`, body)
    .then((res) => go(docPath(workspace, res.data.id)))
    .catch((err) => toast.error(getErrorMessage(err), { position: 'bottom-center' }));

export const toastError = (err: unknown) => toast.error(getErrorMessage(err), { position: 'bottom-center' });

// 누군가 문서·폴더를 만들거나 바꾸면 목록을 다시 불러온다
export const useDocsChanged = (workspace: string, refresh: () => void) => {
  const [socket] = useSocket(workspace);
  useEffect(() => {
    socket?.on('docsChanged', refresh);
    return () => {
      socket?.off('docsChanged', refresh);
    };
  }, [socket, refresh]);
};
