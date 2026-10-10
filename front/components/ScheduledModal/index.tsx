import { FileList, FileRow } from '@components/StorageModal/styles';
import Modal from '@components/Modal';
import useScheduled from '@hooks/useScheduled';
import { describeContent } from '@utils/gif';
import getErrorMessage from '@utils/getErrorMessage';
import { formatWhen } from '@utils/timePresets';
import axios from 'axios';
import React, { FC } from 'react';
import { toast } from 'react-toastify';

interface Props {
  show: boolean;
  workspace: string;
  onCloseModal: () => void;
  // 이 대화(채널 이름 또는 DM 상대 id)의 예약만 보여준다. 없으면 전부
  filter?: { channel?: string; receiverId?: number };
}

const CANCEL_STYLE: React.CSSProperties = {
  flex: '0 0 auto',
  border: '1px solid var(--border-strong)',
  borderRadius: 4,
  background: 'var(--bg)',
  color: 'var(--text)',
  padding: '3px 10px',
  cursor: 'pointer',
};

const preview = (content: string) => {
  const text = describeContent(content).replace(/@\[(.+?)]\((\d+?|channel|here)\)/g, '@$1');
  return text.length > 80 ? `${text.slice(0, 80)}…` : text;
};

// 예약 메시지·리마인더 목록과 취소
const ScheduledModal: FC<Props> = ({ show, workspace, onCloseModal, filter }) => {
  const { scheduled, reminders } = useScheduled(show ? workspace : undefined);
  const items = (scheduled || []).filter(
    (s) => !filter || (filter.channel ? s.Channel?.name === filter.channel : s.ReceiverId === filter.receiverId),
  );

  const cancel = (url: string, message: string) =>
    axios
      .delete(url)
      .then(() => toast.info(message, { position: 'bottom-center' }))
      .catch((error) => toast.error(getErrorMessage(error), { position: 'bottom-center' }));

  return (
    <Modal show={show} onCloseModal={onCloseModal} title="예약된 메시지 · 리마인더">
      <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>예약된 메시지</h3>
      <FileList>
        {!scheduled && <p>불러오는 중...</p>}
        {scheduled && items.length === 0 && <p>예약된 메시지가 없습니다. 입력창의 🕒 예약 으로 만들 수 있어요.</p>}
        {items.map((item) => (
          <FileRow as="div" key={item.id}>
            <span className="info">
              <b title={item.content}>{preview(item.content)}</b>
              <small>
                {formatWhen(item.sendAt)} ·{' '}
                {item.Channel ? `#${item.Channel.name}` : `${item.Receiver?.nickname}님에게 DM`}
              </small>
            </span>
            <button
              type="button"
              style={CANCEL_STYLE}
              onClick={() => cancel(`/api/workspaces/${workspace}/scheduled/${item.id}`, '예약을 취소했습니다.')}
            >
              취소
            </button>
          </FileRow>
        ))}
      </FileList>
      {!filter && (
        <>
          <h3 style={{ margin: '20px 0 8px', fontSize: 15 }}>리마인더</h3>
          <FileList>
            {reminders?.length === 0 && <p>리마인더가 없습니다. 메시지의 ⏰ 로 만들 수 있어요.</p>}
            {reminders?.map((item) => {
              const message = item.Chat || item.DM;
              return (
                <FileRow as="div" key={item.id}>
                  <span className="info">
                    <b>{message ? preview(message.content) : '(지워진 메시지)'}</b>
                    <small>
                      {formatWhen(item.remindAt)} · {item.Chat ? `#${item.Chat.Channel.name}` : 'DM'}
                    </small>
                  </span>
                  <button
                    type="button"
                    style={CANCEL_STYLE}
                    onClick={() =>
                      cancel(`/api/workspaces/${workspace}/reminders/${item.id}`, '리마인더를 취소했습니다.')
                    }
                  >
                    취소
                  </button>
                </FileRow>
              );
            })}
          </FileList>
        </>
      )}
    </Modal>
  );
};

export default ScheduledModal;
