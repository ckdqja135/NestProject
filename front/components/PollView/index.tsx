import styled from '@emotion/styled';
import { IReaction, IUser } from '@typings/db';
import { Poll, POLL_EMOJIS } from '@utils/poll';
import React, { FC } from 'react';

const Box = styled.div`
  flex: 0 0 100%;
  max-width: 480px;
  margin-top: 2px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);

  & > .question {
    margin-bottom: 8px;
    font-weight: 700;
  }

  & > .total {
    margin-top: 6px;
    font-size: 12px;
    color: var(--text-muted);
  }
`;

const Option = styled.button`
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  margin-top: 4px;
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: transparent;
  color: var(--text);
  text-align: left;
  font-size: 14px;
  cursor: pointer;
  overflow: hidden;

  &:disabled {
    cursor: default;
  }

  &.mine {
    border-color: #1264a3;
  }

  /* 득표율 막대 */
  & > .bar {
    position: absolute;
    inset: 0 auto 0 0;
    background: var(--bg-selected);
    z-index: 0;
  }

  & > span {
    position: relative;
    z-index: 1;
  }

  & > .label {
    flex: 1;
    min-width: 0;
    word-break: break-word;
  }

  & > .count {
    color: var(--text-muted);
    font-size: 12px;
  }
`;

interface Props {
  poll: Poll;
  reactions?: IReaction[];
  myId?: number;
  members?: IUser[];
  onVote?: (emoji: string) => void; // 없으면 결과만 보여준다
}

// 투표 메시지: 선택지를 누르면 그 번호 이모지로 리액션 (여러 개 고를 수 있고, 다시 누르면 취소)
const PollView: FC<Props> = ({ poll, reactions = [], myId, members, onVote }) => {
  const nameOf = (id: number) => members?.find((m) => m.id === id)?.nickname || '알 수 없음';
  const votes = poll.o.map((_, index) => reactions.filter((r) => r.emoji === POLL_EMOJIS[index]));
  const voters = new Set(votes.flat().map((r) => r.UserId));
  const max = Math.max(1, ...votes.map((v) => v.length));

  return (
    <Box role="group" aria-label={`투표: ${poll.q}`}>
      <div className="question">📊 {poll.q}</div>
      {poll.o.map((option, index) => {
        const optionVotes = votes[index];
        const mine = optionVotes.some((r) => r.UserId === myId);
        return (
          <Option
            key={index}
            type="button"
            className={mine ? 'mine' : undefined}
            disabled={!onVote}
            aria-pressed={mine}
            title={
              optionVotes.length ? optionVotes.map((r) => nameOf(r.UserId)).join(', ') : '아직 아무도 고르지 않았어요'
            }
            onClick={() => onVote?.(POLL_EMOJIS[index])}
          >
            <span className="bar" style={{ width: `${(optionVotes.length / max) * 100}%` }} aria-hidden="true" />
            <span>{POLL_EMOJIS[index]}</span>
            <span className="label">{option}</span>
            <span className="count">{optionVotes.length}표</span>
          </Option>
        );
      })}
      <div className="total">{voters.size}명 참여 · 선택지를 다시 누르면 취소</div>
    </Box>
  );
};

export default PollView;
