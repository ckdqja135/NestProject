import { draftKey } from '@hooks/useDraft';

const move = (from: string, to: string) => {
  try {
    const value = localStorage.getItem(from);
    if (value !== null) {
      localStorage.setItem(to, value);
      localStorage.removeItem(from);
    }
  } catch {
    // 저장소를 쓸 수 없으면 옮기지 않는다
  }
};

// 채널 이름이 바뀌면 이 기기에 저장한 읽은 시각과 임시 저장 글을 새 이름으로 옮긴다
export const moveChannelKeys = (workspace: string, oldName: string, newName: string) => {
  move(`${workspace}-${oldName}`, `${workspace}-${newName}`);
  move(draftKey(workspace, `channel:${oldName}`), draftKey(workspace, `channel:${newName}`));
};

// 슐랙이 쓰는 다른 키 (워크스페이스 주소가 'shlack' 이어도 옮기지 않는다)
const isAppKey = (key: string) =>
  key.startsWith('shlack-draft-') ||
  key.startsWith('shlack-files') ||
  key === 'shlack-deleted-files' ||
  key === 'shlack-notifications-paused' ||
  key === 'shlack-thread-reads' ||
  key === 'shlack-theme';

// 워크스페이스 주소가 바뀌면 그 워크스페이스의 읽은 시각(`주소-채널`)과 임시 저장 글을 새 주소로 옮긴다
export const moveWorkspaceKeys = (oldUrl: string, newUrl: string) => {
  try {
    const draftPrefix = draftKey(oldUrl, '');
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith(draftPrefix)) {
        move(key, draftKey(newUrl, key.slice(draftPrefix.length)));
      } else if (key.startsWith(`${oldUrl}-`) && !isAppKey(key)) {
        move(key, `${newUrl}-${key.slice(oldUrl.length + 1)}`);
      }
    });
  } catch {
    // 저장소를 쓸 수 없으면 옮기지 않는다
  }
};
