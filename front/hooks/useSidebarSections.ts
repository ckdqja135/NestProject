import useSocket from '@hooks/useSocket';
import fetcher from '@utils/fetcher';
import getErrorMessage from '@utils/getErrorMessage';
import axios from 'axios';
import { useCallback, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';
import useSWR from 'swr';

export type SectionItemKind = 'channel' | 'dm';

export interface ISidebarSection {
  id: number;
  name: string;
  position: number;
  items: { kind: SectionItemKind; id: number }[];
}

// 내가 만든 사이드바 섹션 (채널·DM 을 넣어 묶는다). 다른 기기에서 바꿔도 바로 맞춘다
const useSidebarSections = (workspace?: string) => {
  const key = workspace ? `/api/workspaces/${workspace}/sidebar-sections` : null;
  const { data, mutate } = useSWR<ISidebarSection[]>(key, fetcher);
  const [socket] = useSocket(workspace);
  useEffect(() => {
    const onChanged = () => mutate();
    socket?.on('sidebarSectionsChanged', onChanged);
    return () => {
      socket?.off('sidebarSectionsChanged', onChanged);
    };
  }, [socket, mutate]);

  const sections = useMemo(() => data || [], [data]);
  const base = `/api/workspaces/${workspace}/sidebar-sections`;
  const run = useCallback(
    (request: Promise<unknown>) =>
      request
        .then(() => mutate())
        .catch((error) => {
          toast.error(getErrorMessage(error), { position: 'bottom-center' });
        }),
    [mutate],
  );

  // 이 채널·DM 이 들어 있는 섹션 (없으면 null)
  const sectionOf = useCallback(
    (kind: SectionItemKind, id: number) =>
      sections.find((s) => s.items.some((i) => i.kind === kind && i.id === id))?.id ?? null,
    [sections],
  );
  const create = useCallback(
    (name: string) => axios.post<ISidebarSection>(base, { name }).then((res) => mutate().then(() => res.data)),
    [base, mutate],
  );
  const rename = useCallback((id: number, name: string) => run(axios.patch(`${base}/${id}`, { name })), [base, run]);
  const remove = useCallback((id: number) => run(axios.delete(`${base}/${id}`)), [base, run]);
  // 섹션으로 옮기기 (null 이면 원래 목록으로)
  const move = useCallback(
    (kind: SectionItemKind, id: number, sectionId: number | null) =>
      run(
        sectionId === null
          ? axios.delete(`${base}/items/${kind}/${id}`)
          : axios.put(`${base}/${sectionId}/items/${kind}/${id}`),
      ),
    [base, run],
  );
  return { sections, sectionOf, create, rename, remove, move };
};

export default useSidebarSections;
