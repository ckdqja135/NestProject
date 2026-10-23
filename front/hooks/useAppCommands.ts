import useSocket from '@hooks/useSocket';
import fetcher from '@utils/fetcher';
import { SlashCommand } from '@utils/slashCommands';
import { useEffect, useMemo } from 'react';
import useSWR from 'swr';

interface IAppCommand {
  command: string;
  description: string | null;
  usageHint: string | null;
  appName?: string;
}

// 외부 앱이 등록한 슬래시 명령 (관리자가 바꾸면 바로 다시 받는다)
export default function useAppCommands(workspace?: string): SlashCommand[] {
  const key = workspace ? `/api/workspaces/${workspace}/apps/commands` : null;
  const { data, mutate } = useSWR<IAppCommand[]>(key, fetcher, { revalidateOnFocus: false });
  const [socket] = useSocket(workspace);
  useEffect(() => {
    const onChanged = () => mutate();
    socket?.on('appCommandsChanged', onChanged);
    return () => {
      socket?.off('appCommandsChanged', onChanged);
    };
  }, [socket, mutate]);
  return useMemo(
    () =>
      (data || []).map((c) => ({
        name: c.command,
        usage: `/${c.command}${c.usageHint ? ` ${c.usageHint}` : ''}`,
        description: `${c.description || '앱 명령'} (${c.appName || '앱'})`,
        app: c.appName || '앱',
      })),
    [data],
  );
}
