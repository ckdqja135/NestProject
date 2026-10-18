import useSocket from '@hooks/useSocket';
import getErrorMessage from '@utils/getErrorMessage';
import { useEffect } from 'react';
import { toast } from 'react-toastify';

export const calBase = (workspace: string) => `/api/workspaces/${workspace}/calendar`;

export const toastError = (err: unknown) => toast.error(getErrorMessage(err), { position: 'bottom-center' });

// 누군가 일정을 만들거나 바꾸면 다시 불러온다
export const useCalendarChanged = (workspace: string, refresh: (data?: { id?: number }) => void) => {
  const [socket] = useSocket(workspace);
  useEffect(() => {
    socket?.on('calendarChanged', refresh);
    return () => {
      socket?.off('calendarChanged', refresh);
    };
  }, [socket, refresh]);
};
