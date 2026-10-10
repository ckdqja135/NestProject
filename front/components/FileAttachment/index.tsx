import styled from '@emotion/styled';
import ImageViewer from '@components/ImageViewer';
import useLocalFile from '@hooks/useLocalFile';
import useSocket from '@hooks/useSocket';
import {
  clearDeletedMark,
  downloadFile,
  FileMeta,
  formatSize,
  isDeletedByUser,
  isImageType,
  subscribeUnavailable,
  UnavailableReason,
} from '@utils/fileStore';
import { useParams } from 'react-router';
import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';

// 보낸 지 이 시간이 지나도 이 기기에 없으면 '받지 못한 파일' 로 본다 (보낼 때 오프라인이었음)
const RECEIVE_GRACE_MS = 15_000;
// 보낸 사람에게 다시 요청한 뒤 이 시간 안에 오지 않으면 실패로 본다
const REQUEST_TIMEOUT_MS = 20_000;
// 이번 접속 동안 자동으로 다시 요청한 파일 (같은 파일을 반복 요청하지 않도록)
const autoRequested = new Set<string>();

type Phase = 'idle' | 'requesting' | UnavailableReason | 'timeout';

const UNAVAILABLE_TEXT: Record<string, string> = {
  offline: '보낸 사람이 지금 접속해 있지 않아 받을 수 없습니다. 보낸 사람이 접속해 있을 때 다시 시도하세요.',
  missing: '보낸 사람의 기기에도 이 파일이 없어 받을 수 없습니다.',
  'not-found': '파일을 찾을 수 없습니다.',
  timeout: '보낸 사람에게서 응답이 없습니다. 잠시 후 다시 시도하세요.',
};

const Card = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: 360px;
  margin-top: 4px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);

  & .icon {
    flex: 0 0 36px;
    height: 36px;
    border-radius: 6px;
    background: var(--bg-hover);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
  }

  & .info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;

    & b {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    & small {
      color: var(--text-muted);
    }
  }

  &.missing {
    background: var(--bg-subtle);
    color: var(--text-muted);
  }

  & button {
    border: 1px solid var(--border);
    background: var(--bg);
    border-radius: 6px;
    padding: 4px 10px;
    font-size: 13px;
    cursor: pointer;
    white-space: nowrap;

    &:hover {
      background: var(--bg-hover);
    }
  }
`;

const ImageBox = styled.figure`
  margin: 4px 0 0;
  display: inline-flex;
  flex-direction: column;
  gap: 4px;

  & img {
    max-height: 240px;
    max-width: 100%;
    border-radius: 6px;
    cursor: zoom-in;
  }

  & figcaption {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--text-muted);

    & button {
      border: none;
      background: none;
      padding: 0;
      color: #1264a3;
      cursor: pointer;
      font-size: 12px;
    }
  }
`;

interface Props {
  meta: FileMeta;
  sentAt: Date;
}

// 채팅의 파일: 이 기기 저장소에서 읽어 이미지는 바로 보여주고, 그 외 파일은 '기기에 저장' 으로 내려받는다
const FileAttachment: FC<Props> = ({ meta, sentAt }) => {
  const { workspace } = useParams<{ workspace: string }>();
  const [socket] = useSocket(workspace);
  const { file, loaded } = useLocalFile(meta.id);
  const [now, setNow] = useState(Date.now());
  const [phase, setPhase] = useState<Phase>('idle');
  const [viewing, setViewing] = useState(false);
  const objectUrl = useMemo(
    () => (file && isImageType(meta.type) ? URL.createObjectURL(file.blob) : null),
    [file, meta.type],
  );

  useEffect(
    () => () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    },
    [objectUrl],
  );

  // 아직 도착하지 않은 최근 파일은 잠시 기다렸다가 '받지 못함' 으로 바꾼다
  const waiting = loaded && !file && now - new Date(sentAt).getTime() < RECEIVE_GRACE_MS;
  useEffect(() => {
    if (!waiting) {
      return;
    }
    const timer = setTimeout(() => setNow(Date.now()), RECEIVE_GRACE_MS);
    return () => clearTimeout(timer);
  }, [waiting]);

  // 받지 못한 파일을 접속 중인 보낸 사람에게 다시 요청한다 (서버는 중계만)
  const requestAgain = useCallback(() => {
    if (!socket) {
      return;
    }
    clearDeletedMark(meta.id);
    setPhase('requesting');
    socket.emit('fileRequest', { fileId: meta.id });
  }, [socket, meta.id]);

  useEffect(() => subscribeUnavailable(meta.id, (reason) => setPhase(reason)), [meta.id]);

  // 파일이 도착하면 다시 받기 상태를 초기화 (나중에 지우면 '다시 받기' 를 다시 보여줄 수 있도록)
  useEffect(() => {
    if (file) {
      setPhase('idle');
    }
  }, [file]);

  useEffect(() => {
    if (phase !== 'requesting' || file) {
      return;
    }
    const timer = setTimeout(() => setPhase('timeout'), REQUEST_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [phase, file]);

  const missing = loaded && !file && !waiting;
  // 일부러 지운 파일이 아니면 한 번은 자동으로 다시 요청
  useEffect(() => {
    if (missing && socket && !autoRequested.has(meta.id) && !isDeletedByUser(meta.id)) {
      autoRequested.add(meta.id);
      requestAgain();
    }
  }, [missing, socket, meta.id, requestAgain]);

  if (file && objectUrl) {
    return (
      <ImageBox>
        <img src={objectUrl} alt={meta.name} onClick={() => setViewing(true)} />
        <figcaption>
          <span>
            {meta.name} · {formatSize(meta.size)}
          </span>
          <button type="button" onClick={() => downloadFile(file)}>
            기기에 저장
          </button>
        </figcaption>
        {viewing && (
          <ImageViewer
            src={objectUrl}
            name={meta.name}
            caption={formatSize(meta.size)}
            onDownload={() => downloadFile(file)}
            onClose={() => setViewing(false)}
          />
        )}
      </ImageBox>
    );
  }

  if (file) {
    return (
      <Card>
        <span className="icon" aria-hidden="true">
          📄
        </span>
        <span className="info">
          <b title={meta.name}>{meta.name}</b>
          <small>{formatSize(meta.size)}</small>
        </span>
        <button type="button" onClick={() => downloadFile(file)}>
          기기에 저장
        </button>
      </Card>
    );
  }

  let status = '받는 중...';
  if (missing) {
    if (phase === 'requesting') {
      status = '보낸 사람에게서 가져오는 중...';
    } else if (phase !== 'idle') {
      status = UNAVAILABLE_TEXT[phase];
    } else if (isDeletedByUser(meta.id)) {
      status = '이 기기에서 지운 파일입니다.';
    } else {
      status = '이 기기에 없는 파일입니다.';
    }
  }

  return (
    <Card className="missing">
      <span className="icon" aria-hidden="true">
        {isImageType(meta.type) ? '🖼️' : '📄'}
      </span>
      <span className="info">
        <b title={meta.name}>{meta.name}</b>
        <small>
          {formatSize(meta.size)} · {status}
        </small>
      </span>
      {missing && phase !== 'requesting' && (
        <button type="button" onClick={requestAgain}>
          다시 받기
        </button>
      )}
    </Card>
  );
};

export default FileAttachment;
