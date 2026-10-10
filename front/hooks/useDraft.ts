import { useCallback, useState } from 'react';

// 채널/DM 별로 쓰다 만 메시지를 이 기기에 보관한다 (다른 대화로 옮겼다 와도 남아 있게)
export const draftKey = (workspace: string, target: string) => `shlack-draft-${workspace}-${target}`;

export const loadDraft = (key: string) => {
  try {
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
};

const saveDraft = (key: string, value: string) => {
  try {
    if (value.trim()) {
      localStorage.setItem(key, value);
    } else {
      localStorage.removeItem(key);
    }
  } catch {
    // 저장소를 쓸 수 없으면 임시 저장만 하지 않는다
  }
};

export default function useDraft(key: string): [string, (value: string) => void] {
  const [draft, setDraft] = useState(() => ({ key, value: loadDraft(key) }));
  // 대화를 옮기면(key 가 바뀌면) 그 대화의 임시 저장 글을 보여준다
  const value = draft.key === key ? draft.value : loadDraft(key);
  const setValue = useCallback(
    (next: string) => {
      setDraft({ key, value: next });
      saveDraft(key, next);
    },
    [key],
  );
  return [value, setValue];
}
