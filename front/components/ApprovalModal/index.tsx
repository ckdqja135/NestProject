import Modal from '@components/Modal';
import { Actions, Field, FormError, TextInput } from '@components/ModalForm/styles';
import { IUser } from '@typings/db';
import { ApprovalKind, KIND_FIELDS, KIND_LABELS } from '@utils/approval';
import { avatarUrl } from '@utils/avatar';
import fetcher from '@utils/fetcher';
import getErrorMessage from '@utils/getErrorMessage';
import axios from 'axios';
import { ArrowDown, ArrowUp, FileCheck2, X } from 'lucide-react';
import React, { FC, useState } from 'react';
import { toast } from 'react-toastify';
import useSWR from 'swr';
import { Approvers, BodyInput } from './styles';

interface Props {
  show: boolean;
  workspace: string;
  myId: number;
  // 카드를 올릴 곳
  target: { channel: string } | { dmUserId: number };
  // 올린 카드는 내 소켓으로 다시 오지 않으므로, 대화 목록을 새로 받게 알린다
  onCreated?: () => void;
  onClose: () => void;
}

// 결재 요청: 종류·제목·내용과 결재자 순서를 정하면 이 대화에 카드로 올린다
const ApprovalModal: FC<Props> = ({ show, workspace, myId, target, onCreated, onClose }) => {
  const { data: members } = useSWR<IUser[]>(show ? `/api/workspaces/${workspace}/members` : null, fetcher);
  const [kind, setKind] = useState<ApprovalKind>('general');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  // DM 이면 그 상대를 첫 결재자 후보로
  const [approverIds, setApproverIds] = useState<number[]>(() => ('dmUserId' in target ? [target.dmUserId] : []));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const people = (members || []).filter((m) => !m.bot && m.id !== myId);
  // DM 상대가 봇이면 결재자 후보에서 빠진다
  const chosen = approverIds.filter((id) => people.some((p) => p.id === id));
  const candidates = people.filter((m) => !approverIds.includes(m.id));
  const move = (index: number, delta: number) =>
    setApproverIds((ids) => {
      const next = [...ids];
      const [item] = next.splice(index, 1);
      next.splice(index + delta, 0, item);
      return next;
    });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !chosen.length || pending) return;
    setPending(true);
    setError('');
    const filled = Object.fromEntries(Object.entries(fields).filter(([, v]) => v.trim()));
    axios
      .post(`/api/workspaces/${workspace}/approvals`, {
        kind,
        title: title.trim(),
        body: body.trim() || undefined,
        fields: Object.keys(filled).length ? filled : undefined,
        approverIds: chosen,
        ...target,
      })
      .then(() => {
        toast.success('결재를 요청했어요. 첫 결재자에게 알렸어요.', { position: 'bottom-center' });
        onCreated?.();
        onClose();
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setPending(false));
  };

  return (
    <Modal
      show={show}
      onCloseModal={onClose}
      title="결재 요청"
      icon={<FileCheck2 size={21} />}
      description="결재자가 순서대로 승인하거나 반려해요. 차례가 되면 알림이 가요."
    >
      <form onSubmit={submit}>
        {error && <FormError role="alert">{error}</FormError>}
        <Field>
          <label htmlFor="approval-kind">종류</label>
          <select
            id="approval-kind"
            className="select"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as ApprovalKind);
              setFields({});
            }}
          >
            {(Object.keys(KIND_LABELS) as ApprovalKind[]).map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </Field>
        <Field>
          <label htmlFor="approval-title">제목</label>
          <TextInput
            id="approval-title"
            value={title}
            maxLength={200}
            autoFocus
            onChange={(e) => setTitle(e.target.value)}
            placeholder={kind === 'leave' ? '예: 11월 2일 연차' : kind === 'purchase' ? '예: 디자인팀 모니터 구매' : ''}
          />
        </Field>
        {KIND_FIELDS[kind].map((f) => (
          <Field key={f.key}>
            <label htmlFor={`approval-${f.key}`}>{f.label}</label>
            {f.type === 'select' ? (
              <select
                id={`approval-${f.key}`}
                className="select"
                value={fields[f.key] || ''}
                onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })}
              >
                <option value="">고르기</option>
                {f.options?.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : (
              <TextInput
                id={`approval-${f.key}`}
                type={f.type === 'date' ? 'date' : 'text'}
                inputMode={f.type === 'money' ? 'numeric' : undefined}
                value={fields[f.key] || ''}
                maxLength={100}
                onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })}
                placeholder={f.type === 'money' ? '원 단위 숫자' : ''}
              />
            )}
          </Field>
        ))}
        <Field>
          <label htmlFor="approval-body">내용</label>
          <BodyInput
            id="approval-body"
            value={body}
            maxLength={4000}
            rows={3}
            onChange={(e) => setBody(e.target.value)}
            placeholder="필요한 설명을 적어 주세요"
          />
        </Field>
        <Field>
          <label htmlFor="approval-add">결재자 (순서대로)</label>
          <Approvers>
            {approverIds.map((id, i) => {
              const m = people.find((p) => p.id === id);
              if (!m) return null;
              return (
                <li key={id}>
                  <span className="order">{i + 1}</span>
                  <img src={avatarUrl(m, 40)} alt="" />
                  <span className="name">{m.nickname}</span>
                  <button
                    type="button"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    aria-label={`${m.nickname} 앞으로`}
                  >
                    <ArrowUp size={13} />
                  </button>
                  <button
                    type="button"
                    disabled={i === approverIds.length - 1}
                    onClick={() => move(i, 1)}
                    aria-label={`${m.nickname} 뒤로`}
                  >
                    <ArrowDown size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setApproverIds((ids) => ids.filter((x) => x !== id))}
                    aria-label={`${m.nickname} 빼기`}
                  >
                    <X size={13} />
                  </button>
                </li>
              );
            })}
          </Approvers>
          {approverIds.length < 5 && (
            <select
              id="approval-add"
              className="select"
              value=""
              onChange={(e) => e.target.value && setApproverIds((ids) => [...ids, Number(e.target.value)])}
            >
              <option value="">＋ 결재자 더하기</option>
              {candidates.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nickname}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Actions>
          <button type="button" onClick={onClose}>
            취소
          </button>
          <button type="submit" className="primary" disabled={!title.trim() || !chosen.length || pending}>
            {pending ? '요청하는 중...' : '결재 요청'}
          </button>
        </Actions>
      </form>
    </Modal>
  );
};

export default ApprovalModal;
