// 주고받은 파일을 이 기기의 브라우저 저장소(IndexedDB)에 보관한다. 서버에는 저장되지 않는다.
export interface FileMeta {
  id: string;
  name: string;
  type: string;
  size: number;
}

export interface StoredFile extends FileMeta {
  blob: Blob;
  savedAt: number;
}

const DB_NAME = 'shlack-files';
const STORE = 'files';
let dbPromise: Promise<IDBDatabase> | null = null;

const openDB = () => {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(STORE, { keyPath: 'id' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        dbPromise = null;
        reject(request.error);
      };
    });
  }
  return dbPromise;
};

// 파일이 저장되면 그 파일을 기다리던 화면에 알린다
const listeners = new Map<string, Set<() => void>>();
export const subscribeFile = (id: string, listener: () => void) => {
  if (!listeners.has(id)) {
    listeners.set(id, new Set());
  }
  listeners.get(id)!.add(listener);
  return () => {
    listeners.get(id)?.delete(listener);
  };
};

export async function putFile(meta: FileMeta, blob: Blob) {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ ...meta, blob, savedAt: Date.now() } as StoredFile);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  listeners.get(meta.id)?.forEach((listener) => listener());
}

export async function getFile(id: string): Promise<StoredFile | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// 채팅 본문 `file:{...}` 에서 파일 정보 읽기
export const FILE_PREFIX = 'file:';
export const parseFileContent = (content: string): FileMeta | null => {
  if (!content.startsWith(FILE_PREFIX)) {
    return null;
  }
  try {
    const meta = JSON.parse(content.slice(FILE_PREFIX.length));
    return typeof meta?.id === 'string' && typeof meta?.name === 'string' ? meta : null;
  } catch {
    return null;
  }
};

export const isImageType = (type: string) => type.startsWith('image/');

export const formatSize = (size: number) => {
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
};

// 브라우저 다운로드로 기기에 파일 저장
export const downloadFile = (file: StoredFile) => {
  const url = URL.createObjectURL(file.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// ---- 목록/삭제 (기기 저장 공간 관리) ----
export async function listFiles(): Promise<StoredFile[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    request.onsuccess = () => resolve((request.result as StoredFile[]).sort((a, b) => b.savedAt - a.savedAt));
    request.onerror = () => reject(request.error);
  });
}

// 사용자가 일부러 지운 파일은 자동으로 다시 받아오지 않는다 (직접 '다시 받기' 를 누르면 받음)
const DELETED_KEY = 'shlack-deleted-files';
const readDeleted = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(DELETED_KEY) || '[]');
  } catch {
    return [];
  }
};
export const isDeletedByUser = (id: string) => readDeleted().includes(id);
export const clearDeletedMark = (id: string) => {
  try {
    localStorage.setItem(DELETED_KEY, JSON.stringify(readDeleted().filter((x) => x !== id)));
  } catch {
    // 저장소를 못 쓰는 환경이면 무시
  }
};

export async function deleteFiles(ids: string[]) {
  if (!ids.length) {
    return;
  }
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    ids.forEach((id) => tx.objectStore(STORE).delete(id));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  try {
    // 최근 1000개까지만 기억
    localStorage.setItem(DELETED_KEY, JSON.stringify([...ids, ...readDeleted()].slice(0, 1000)));
  } catch {
    // 저장소를 못 쓰는 환경이면 무시
  }
  ids.forEach((id) => listeners.get(id)?.forEach((listener) => listener()));
}

// ---- 받지 못한 파일 다시 받기 상태 ----
export type UnavailableReason = 'offline' | 'missing' | 'not-found';
const unavailableListeners = new Map<string, Set<(reason: UnavailableReason) => void>>();
export const subscribeUnavailable = (id: string, listener: (reason: UnavailableReason) => void) => {
  if (!unavailableListeners.has(id)) {
    unavailableListeners.set(id, new Set());
  }
  unavailableListeners.get(id)!.add(listener);
  return () => {
    unavailableListeners.get(id)?.delete(listener);
  };
};
export const notifyUnavailable = (id: string, reason: UnavailableReason) =>
  unavailableListeners.get(id)?.forEach((listener) => listener(reason));

// 브라우저가 이 사이트에 허용한 저장 공간
export const estimateStorage = async () => {
  if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    return { usage, quota };
  }
  return null;
};
