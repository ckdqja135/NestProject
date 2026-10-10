import Modal from '@components/Modal';
import { Actions } from '@components/ModalForm/styles';
import { deleteFiles, estimateStorage, formatSize, listFiles, StoredFile } from '@utils/fileStore';
import dayjs from 'dayjs';
import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { FileList, FileRow, Summary } from './styles';

const OLD_DAYS = 30;

interface Props {
  show: boolean;
  onCloseModal: () => void;
}

// 이 기기(브라우저)에 저장된 주고받은 파일 관리
const StorageModal: FC<Props> = ({ show, onCloseModal }) => {
  const [files, setFiles] = useState<StoredFile[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [quota, setQuota] = useState<{ usage: number; quota: number } | null>(null);

  const reload = useCallback(() => {
    listFiles()
      .then(setFiles)
      .catch(() => setFiles([]));
    estimateStorage().then(setQuota);
  }, []);

  useEffect(() => {
    if (show) {
      setSelected(new Set());
      reload();
    }
  }, [show, reload]);

  const total = useMemo(() => (files || []).reduce((sum, f) => sum + f.size, 0), [files]);
  const oldIds = useMemo(
    () => (files || []).filter((f) => dayjs().diff(f.savedAt, 'day') >= OLD_DAYS).map((f) => f.id),
    [files],
  );

  const remove = useCallback(
    (ids: string[], label: string) => {
      deleteFiles(ids)
        .then(() => {
          toast.info(`${label} 파일 ${ids.length}개를 이 기기에서 지웠습니다.`, { position: 'bottom-center' });
          setSelected(new Set());
          reload();
        })
        .catch(() => toast.error('파일을 지우지 못했습니다.', { position: 'bottom-center' }));
    },
    [reload],
  );

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

  return (
    <Modal
      show={show}
      onCloseModal={onCloseModal}
      title="이 기기의 파일"
      description="주고받은 파일은 서버가 아니라 이 브라우저에만 저장됩니다. 지운 파일은 보낸 사람이 접속해 있을 때 '다시 받기'로 받을 수 있습니다."
    >
      <Summary>
        <span>
          파일 {files?.length ?? 0}개 · {formatSize(total)}
        </span>
        {quota && quota.quota > 0 && (
          <span>
            브라우저 사용량 {formatSize(quota.usage)} / {formatSize(quota.quota)}
          </span>
        )}
      </Summary>
      <FileList>
        {!files && <p>불러오는 중...</p>}
        {files?.length === 0 && <p>저장된 파일이 없습니다.</p>}
        {files?.map((f) => (
          <FileRow key={f.id}>
            <input
              type="checkbox"
              checked={selected.has(f.id)}
              onChange={() => toggle(f.id)}
              aria-label={`${f.name} 선택`}
            />
            <span className="info">
              <b title={f.name}>{f.name}</b>
              <small>
                {formatSize(f.size)} · {dayjs(f.savedAt).format('YYYY-MM-DD HH:mm')}
              </small>
            </span>
          </FileRow>
        ))}
      </FileList>
      <Actions>
        <button type="button" disabled={!oldIds.length} onClick={() => remove(oldIds, `${OLD_DAYS}일 지난`)}>
          {OLD_DAYS}일 지난 파일 지우기 ({oldIds.length})
        </button>
        <button
          type="button"
          className="primary"
          disabled={!selected.size}
          onClick={() => remove(Array.from(selected), '선택한')}
        >
          선택한 파일 지우기 ({selected.size})
        </button>
      </Actions>
    </Modal>
  );
};

export default StorageModal;
