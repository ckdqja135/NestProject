import Modal from '@components/Modal';
import styled from '@emotion/styled';
import fetcher from '@utils/fetcher';
import { renderMarkdown } from '@utils/markdown';
import dayjs from 'dayjs';
import React, { FC } from 'react';
import useSWR from 'swr';

const Versions = styled.ol`
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 60vh;
  overflow-y: auto;

  & > li {
    padding: 10px 0;
    border-bottom: 1px solid var(--border);

    &:last-child {
      border-bottom: none;
    }
  }

  & .meta {
    margin-bottom: 4px;
    font-size: 12px;
    color: var(--text-muted);

    & b {
      color: var(--text);
    }
  }

  & .body {
    word-break: break-word;
  }
`;

interface Props {
  show: boolean;
  historyUrl: string;
  workspace: string;
  onCloseModal: () => void;
}

// 메시지 수정 내역: 처음 내용부터 지금 내용까지
const EditHistoryModal: FC<Props> = ({ show, historyUrl, workspace, onCloseModal }) => {
  const { data: versions, error } = useSWR<{ content: string; at: string }[]>(show ? historyUrl : null, fetcher);

  return (
    <Modal show={show} onCloseModal={onCloseModal} title="수정 내역">
      {error && <p>수정 내역을 불러오지 못했습니다.</p>}
      {!versions && !error && <p>불러오는 중...</p>}
      <Versions>
        {versions?.map((version, index) => (
          <li key={index}>
            <div className="meta">
              <b>{index === 0 ? '처음' : index === versions.length - 1 ? '지금' : `수정 ${index}`}</b> ·{' '}
              {dayjs(version.at).format('YYYY-MM-DD A h:mm').replace('AM', '오전').replace('PM', '오후')}
            </div>
            <div className="body">{renderMarkdown(version.content, workspace)}</div>
          </li>
        ))}
      </Versions>
    </Modal>
  );
};

export default EditHistoryModal;
