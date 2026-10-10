import { getFile, StoredFile, subscribeFile } from '@utils/fileStore';
import { useEffect, useState } from 'react';

// 이 기기에 저장된 파일을 읽는다. 아직 없으면 도착할 때까지 기다린다.
const useLocalFile = (id?: string) => {
  const [file, setFile] = useState<StoredFile | undefined>();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!id) {
      return;
    }
    let cancelled = false;
    const load = () =>
      getFile(id)
        .then((stored) => {
          if (!cancelled) {
            setFile(stored);
            setLoaded(true);
          }
        })
        .catch(() => !cancelled && setLoaded(true));
    load();
    const unsubscribe = subscribeFile(id, load);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [id]);

  return { file, loaded };
};

export default useLocalFile;
