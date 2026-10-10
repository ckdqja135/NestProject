import styled from '@emotion/styled';
import useLocalFile from '@hooks/useLocalFile';
import { downloadFile, FileMeta, formatSize, isImageType } from '@utils/fileStore';
import React, { FC, useEffect, useMemo, useState } from 'react';

// 보낸 지 이 시간이 지나도 이 기기에 없으면 '받지 못한 파일' 로 본다 (보낼 때 오프라인이었음)
const RECEIVE_GRACE_MS = 15_000;

const Card = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: 360px;
  margin-top: 4px;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: white;

  & .icon {
    flex: 0 0 36px;
    height: 36px;
    border-radius: 6px;
    background: #f2f2f2;
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
      color: #616061;
    }
  }

  &.missing {
    background: #fafafa;
    color: #616061;
  }

  & button {
    border: 1px solid #ccc;
    background: white;
    border-radius: 6px;
    padding: 4px 10px;
    font-size: 13px;
    cursor: pointer;
    white-space: nowrap;

    &:hover {
      background: #f2f2f2;
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
    color: #616061;

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
  const { file, loaded } = useLocalFile(meta.id);
  const [now, setNow] = useState(Date.now());
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

  if (file && objectUrl) {
    return (
      <ImageBox>
        <img src={objectUrl} alt={meta.name} onClick={() => window.open(objectUrl, '_blank')} />
        <figcaption>
          <span>
            {meta.name} · {formatSize(meta.size)}
          </span>
          <button type="button" onClick={() => downloadFile(file)}>
            기기에 저장
          </button>
        </figcaption>
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

  return (
    <Card className="missing">
      <span className="icon" aria-hidden="true">
        {isImageType(meta.type) ? '🖼️' : '📄'}
      </span>
      <span className="info">
        <b title={meta.name}>{meta.name}</b>
        <small>
          {formatSize(meta.size)} ·{' '}
          {!loaded || waiting ? '받는 중...' : '이 기기에서 받지 못한 파일입니다 (보낼 때 접속해 있지 않았음)'}
        </small>
      </span>
    </Card>
  );
};

export default FileAttachment;
