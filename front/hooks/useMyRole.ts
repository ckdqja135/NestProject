import { IUser, WorkspaceRole } from '@typings/db';
import fetcher from '@utils/fetcher';
import useSWR from 'swr';

export const ROLE_LABELS: Record<WorkspaceRole, string> = {
  owner: '소유자',
  admin: '관리자',
  member: '멤버',
  guest: '게스트',
};

export const isAdminRole = (role: WorkspaceRole | null | undefined) => role === 'owner' || role === 'admin';

// 이 워크스페이스에서 내 역할 (멤버 목록을 받기 전에는 null)
export default function useMyRole(workspace?: string): WorkspaceRole | null {
  const { data: me } = useSWR<IUser | false>('/api/users', fetcher);
  const { data: members } = useSWR<IUser[]>(me && workspace ? `/api/workspaces/${workspace}/members` : null, fetcher);
  if (!me || !members) return null;
  return members.find((m) => m.id === me.id)?.role || 'member';
}
