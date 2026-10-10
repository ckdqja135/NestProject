import styled from '@emotion/styled';
import ScheduledModal from '@components/ScheduledModal';
import useScheduled from '@hooks/useScheduled';
import React, { FC, useState } from 'react';

const Bar = styled.button`
  margin: 0 20px 6px;
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--bg-subtle);
  color: var(--text-muted);
  font-size: 12px;
  cursor: pointer;
  align-self: flex-start;

  &:hover {
    color: var(--text);
  }
`;

interface Props {
  workspace: string;
  channel?: string;
  receiverId?: number;
}

// 입력창 위: 이 대화에 예약된 메시지가 있으면 개수와 '보기'
const ScheduledBar: FC<Props> = ({ workspace, channel, receiverId }) => {
  const { scheduled } = useScheduled(workspace);
  const [show, setShow] = useState(false);
  const count = (scheduled || []).filter((s) =>
    channel ? s.Channel?.name === channel : s.ReceiverId === receiverId,
  ).length;
  if (!count && !show) {
    return null;
  }
  return (
    <>
      {count > 0 && (
        <Bar type="button" onClick={() => setShow(true)}>
          🕒 이 대화에 예약된 메시지 {count}개 · 보기
        </Bar>
      )}
      <ScheduledModal
        show={show}
        workspace={workspace}
        onCloseModal={() => setShow(false)}
        filter={channel ? { channel } : { receiverId }}
      />
    </>
  );
};

export default ScheduledBar;
