import useSocket from '@hooks/useSocket';
import { IReminder, IScheduledMessage } from '@typings/db';
import fetcher from '@utils/fetcher';
import { useEffect } from 'react';
import useSWR from 'swr';

// 내 예약 메시지·리마인더 목록. 예약을 만들거나 보내지면(서버가 scheduledChanged) 다시 불러온다.
export default function useScheduled(workspace?: string) {
  const [socket] = useSocket(workspace);
  const scheduled = useSWR<IScheduledMessage[]>(workspace ? `/api/workspaces/${workspace}/scheduled` : null, fetcher);
  const reminders = useSWR<IReminder[]>(workspace ? `/api/workspaces/${workspace}/reminders` : null, fetcher);
  const { mutate: refreshScheduled } = scheduled;
  const { mutate: refreshReminders } = reminders;

  useEffect(() => {
    const refresh = () => {
      refreshScheduled();
      refreshReminders();
    };
    socket?.on('scheduledChanged', refresh);
    return () => {
      socket?.off('scheduledChanged', refresh);
    };
  }, [socket, refreshScheduled, refreshReminders]);

  return { scheduled: scheduled.data, reminders: reminders.data };
}
