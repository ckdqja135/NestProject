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
