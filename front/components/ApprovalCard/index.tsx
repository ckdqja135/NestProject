import useSocket from '@hooks/useSocket';
import { ApprovalKind, formatMoney, KIND_FIELDS, KIND_LABELS, STATUS_LABELS } from '@utils/approval';
import { avatarUrl } from '@utils/avatar';
import fetcher from '@utils/fetcher';
import getErrorMessage from '@utils/getErrorMessage';
import axios from 'axios';
import dayjs from 'dayjs';
import { Check, Clock, Lock, Minus, X } from 'lucide-react';
import React, { FC, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import useSWR from 'swr';
import { Card } from './styles';

interface Person {
  id: number;
  nickname: string;
  email: string;
  avatarStyle?: string | null;
}

export interface IApproval {
  id: number;
  kind: ApprovalKind;
  title: string;
  body: string | null;
  fields: Record<string, string>;
  status: 'pending' | 'approved' | 'rejected' | 'canceled';
  createdAt: string;
  decidedAt: string | null;
  requester: Person | null;
  steps: {
    position: number;
    status: 'waiting' | 'pending' | 'approved' | 'rejected' | 'skipped';
    comment: string | null;
    decidedAt: string | null;
    approver: Person | null;
  }[];
  myTurn: boolean;
  canCancel: boolean;
}

const STEP_ICON = {
  approved: <Check size={11} />,
  rejected: <X size={11} />,
  pending: <Clock size={11} />,
  waiting: <Minus size={11} />,
  skipped: <Minus size={11} />,
};
const STEP_LABEL = { approved: '승인', rejected: '반려', pending: '결재 중', waiting: '대기', skipped: '-' };

// 채팅 속 결재 카드: 내용과 결재 진행, 내 차례면 승인·반려, 요청자는 취소
const ApprovalCard: FC<{ workspace: string; id: number; note?: string }> = ({ workspace, id, note }) => {
  const key = `/api/workspaces/${workspace}/approvals/${id}`;
  const { data, error, mutate } = useSWR<IApproval>(key, fetcher, { shouldRetryOnError: false });
  const [socket] = useSocket(workspace);
  const [rejecting, setRejecting] = useState(false);
  const [comment, setComment] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const onUpdated = (payload: { id: number }) => {
      if (payload.id === id) mutate();
    };
    socket?.on('approvalUpdated', onUpdated);
    return () => {
      socket?.off('approvalUpdated', onUpdated);
    };
  }, [socket, id, mutate]);

  const act = (path: string, body?: object, done?: string) => {
    setPending(true);
    axios
      .post<IApproval>(`${key}/${path}`, body)
      .then(({ data: next }) => {
        mutate(next, false);
        setRejecting(false);
        setComment('');
        if (done) toast.info(done, { position: 'bottom-center' });
      })
      .catch((err) => toast.error(getErrorMessage(err), { position: 'bottom-center' }))
      .finally(() => setPending(false));
  };

  if (error) {
    return (
      <Card className="denied" data-approval-card={id}>
        <Lock size={14} /> 볼 수 없는 결재예요
      </Card>
    );
  }
  if (!data) return <Card className="loading" aria-hidden="true" />;

  const fields = KIND_FIELDS[data.kind] || [];
  return (
    <div data-approval-card={id}>
      {note && <p className="approval-note">{note}</p>}
      <Card className={`status-${data.status}`} aria-label={`결재: ${data.title}`}>
        <header>
          <span className="kind">{KIND_LABELS[data.kind] || '결재'}</span>
          <span className={`status ${data.status}`}>{STATUS_LABELS[data.status]}</span>
        </header>
        <b className="title">{data.title}</b>
        <small className="by">
          {data.requester?.nickname} · {dayjs(data.createdAt).format('M/D HH:mm')} 요청
        </small>
        {fields.some((f) => data.fields[f.key]) && (
          <dl>
            {fields
              .filter((f) => data.fields[f.key])
              .map((f) => (
                <React.Fragment key={f.key}>
                  <dt>{f.label}</dt>
                  <dd>{f.type === 'money' ? formatMoney(data.fields[f.key]) : data.fields[f.key]}</dd>
                </React.Fragment>
              ))}
          </dl>
        )}
        {data.body && <p className="body">{data.body}</p>}
        <ol className="steps" aria-label="결재 진행">
          {data.steps.map((s) => (
            <li key={s.position} className={s.status} title={s.comment || undefined}>
              {s.approver && <img src={avatarUrl(s.approver, 40)} alt="" />}
              <span className="who">{s.approver?.nickname}</span>
              <span className="state">
                {STEP_ICON[s.status]} {STEP_LABEL[s.status]}
              </span>
              {s.comment && <span className="comment">“{s.comment}”</span>}
            </li>
          ))}
        </ol>
        {data.myTurn && !rejecting && (
          <div className="actions">
            <button
              type="button"
              className="approve"
              disabled={pending}
              onClick={() => act('decision', { decision: 'approve' }, '승인했어요.')}
            >
              <Check size={14} /> 승인
            </button>
            <button type="button" className="reject" disabled={pending} onClick={() => setRejecting(true)}>
              <X size={14} /> 반려
            </button>
          </div>
        )}
        {data.myTurn && rejecting && (
          <div className="reject-form">
            <input
              autoFocus
              value={comment}
              maxLength={500}
              onChange={(e) => setComment(e.target.value)}
              placeholder="반려 사유 (요청한 사람에게 보여요)"
              aria-label="반려 사유"
            />
            <button type="button" onClick={() => setRejecting(false)}>
              취소
            </button>
            <button
              type="button"
              className="reject"
              disabled={pending}
              onClick={() => act('decision', { decision: 'reject', comment }, '반려했어요.')}
            >
              반려하기
            </button>
          </div>
        )}
        {data.canCancel && (
          <div className="actions">
            <button type="button" disabled={pending} onClick={() => act('cancel', undefined, '요청을 취소했어요.')}>
              요청 취소
            </button>
          </div>
        )}
      </Card>
    </div>
  );
};

export default ApprovalCard;
