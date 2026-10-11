import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';

// 채널/DM 별로 쓰다 만 메시지. 이 기기에 바로 보관하고 서버(drafts)에도 보내서 다른 기기와 맞춘다.
// target: channel:채널이름 또는 dm:상대id
export const draftKey = (workspace: string, target: string) => `shlack-draft-${workspace}-${target}`;
// 기기마다 각 임시 저장 글을 마지막으로 고친 시각 (서버 것과 비교해 더 나중 것을 쓴다)
export const DRAFT_TIMES_KEY = 'shlack-draft-times';

export const loadDraft = (key: string) => {
  try {
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
};

const loadTimes = (): Record<string, number> => {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_TIMES_KEY) || '{}');
  } catch {
    return {};
  }
};

const saveLocal = (key: string, value: string, at: number) => {
  try {
    if (value.trim()) {
      localStorage.setItem(key, value);
    } else {
      localStorage.removeItem(key);
    }
    localStorage.setItem(DRAFT_TIMES_KEY, JSON.stringify({ ...loadTimes(), [key]: at }));
  } catch {
    // 저장소를 쓸 수 없으면 서버에만 남긴다
  }
};

type Listener = (key: string) => void;
const listeners = new Set<Listener>();

// 서버로 보내기 (입력할 때마다가 아니라 잠깐 멈췄을 때)
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const queueServer = (workspace: string, target: string, content: string, at: number) => {
  const id = `${workspace}|${target}`;
  clearTimeout(timers.get(id));
  timers.set(
    id,
    setTimeout(() => {
      timers.delete(id);
      axios.put(`/api/workspaces/${workspace}/drafts`, { key: target, content, at }).catch(() => undefined);
    }, 800),
  );
};

// 서버(다른 기기)의 임시 저장 글 중 이 기기 것보다 나중에 고친 것을 반영한다
export const applyServerDrafts = (workspace: string, drafts: Record<string, { content: string; at: number }>) => {
  const times = loadTimes();
  Object.entries(drafts).forEach(([target, draft]) => {
    const key = draftKey(workspace, target);
    if (draft.at > (times[key] || 0)) {
      saveLocal(key, draft.content, draft.at);
      listeners.forEach((listener) => listener(key));
    }
  });
};

export default function useDraft(workspace: string, target: string): [string, (value: string) => void] {
  const key = draftKey(workspace, target);
  const [draft, setDraft] = useState(() => ({ key, value: loadDraft(key) }));
  // 대화를 옮기면(key 가 바뀌면) 그 대화의 임시 저장 글을 보여준다
  const value = draft.key === key ? draft.value : loadDraft(key);

  // 다른 기기에서 더 나중에 고친 글이 오면 바꿔 보여준다
  useEffect(() => {
    const listener = (changed: string) => {
      if (changed === key) {
        setDraft({ key, value: loadDraft(key) });
      }
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [key]);

  const setValue = useCallback(
    (next: string) => {
      const at = Date.now();
      setDraft({ key, value: next });
      saveLocal(key, next, at);
      queueServer(workspace, target, next, at);
    },
    [key, workspace, target],
  );
  return [value, setValue];
}
