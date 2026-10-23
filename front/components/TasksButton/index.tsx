import styled from '@emotion/styled';
import { BellButton, Dropdown, Wrapper } from '@components/MentionsButton/styles';
import useSocket from '@hooks/useSocket';
import { IUser } from '@typings/db';
import fetcher from '@utils/fetcher';
import dayjs from 'dayjs';
import { FileCheck2, ListTodo } from 'lucide-react';
import ApprovalCard from '@components/ApprovalCard';
import Modal from '@components/Modal';
import { ApprovalKind, KIND_LABELS } from '@utils/approval';
import React, { FC, useEffect, useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { toast } from 'react-toastify';
import useSWR from 'swr';

export interface IMyTask {
  docId: number;
  rowId: string;
  title: string;
  due: string | null;
  statusName: string | null;
  done: boolean;
  docTitle: string;
}

// 🧵 버튼 왼쪽에 놓는다
const TasksWrapper = styled(Wrapper)`
  right: 176px;
`;

const List = styled.ul`
  margin: 0;
  padding: 4px 0;
  overflow-y: auto;
  list-style: none;

  & li {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 8px 16px;

    &:hover {
      background: var(--bg-hover);
    }

    &.section {
      padding: 8px 16px 2px;
      color: var(--text-muted);
      font-size: 11px;
      font-weight: 700;

      &:hover {
        background: transparent;
      }
    }

    &.done .title {
      color: var(--text-muted);
      text-decoration: line-through;
    }

    & input {
      margin-top: 3px;
      cursor: pointer;
    }

    & button.open {
      flex: 1;
      min-width: 0;
      padding: 0;
      border: none;
      background: transparent;
      color: var(--text);
      text-align: left;
      cursor: pointer;
    }

    & .title {
      display: block;
      overflow: hidden;
      font-size: 14px;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    & .meta {
      display: block;
      color: var(--text-muted);
      font-size: 12px;

      & .late {
        color: #e01e5a;
        font-weight: 700;
      }

      & .today {
        color: #e8891d;
        font-weight: 700;
      }
    }
  }

  & .empty {
    padding: 16px;
    color: var(--text-muted);
    font-size: 13px;
    line-height: 1.6;
  }
`;

const DONE_NAMES = ['완료', '끝', '종료', 'done', 'complete', 'completed'];

const dueLabel = (due: string | null) => {
  if (!due) return null;
  const days = dayjs(due).startOf('day').diff(dayjs().startOf('day'), 'day');
  if (days < 0) return <span className="late">{-days}일 지남</span>;
  if (days === 0) return <span className="today">오늘 마감</span>;
  if (days === 1) return <span>내일 마감</span>;
  return <span>{dayjs(due).format('M/D')} 마감</span>;
};

// 상단 바의 ✅ 버튼: 여러 데이터베이스에 흩어진 "내 할 일" 모아 보기 (오늘 마감·지난 것 개수 표시)
const TasksButton: FC<{ workspace: string; me: IUser }> = ({ workspace, me }) => {
  const history = useHistory();
  const [socket] = useSocket(workspace);
  const key = `/api/workspaces/${workspace}/tasks`;
  const { data, mutate } = useSWR<IMyTask[]>(key, fetcher);
  // 내가 결재할 차례인 것
  const { data: approvals, mutate: mutateApprovals } = useSWR<
    { id: number; title: string; kind: string; requesterName: string; createdAt: string }[]
  >(`/api/workspaces/${workspace}/approvals/pending`, fetcher);
  const [openApproval, setOpenApproval] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onChanged = () => mutate();
    const onApproval = () => mutateApprovals();
    socket?.on('tasksChanged', onChanged);
    socket?.on('approvalUpdated', onApproval);
    // 결재 요청 카드는 봇 DM 으로 오므로 새 DM 이 오면 다시 본다
    socket?.on('dm', onApproval);
    return () => {
      socket?.off('tasksChanged', onChanged);
      socket?.off('approvalUpdated', onApproval);
      socket?.off('dm', onApproval);
    };
  }, [socket, mutate, mutateApprovals]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);

  const tasks = data || [];
  const today = dayjs().format('YYYY-MM-DD');
  const waiting = approvals || [];
  const urgent = tasks.filter((t) => !t.done && t.due && t.due <= today).length + waiting.length;
  const shown = tasks.filter((t) => showDone || !t.done);

  // 완료 표시: 그 데이터베이스에 잠깐 붙어 상태(또는 체크 칸)를 바꾼다
  const toggleDone = (task: IMyTask) => {
    if (!socket) return;
    const done = !task.done;
    mutate(
      tasks.map((t) => (t.docId === task.docId && t.rowId === task.rowId ? { ...t, done } : t)),
      false,
    );
    // 데이터베이스 코드는 누를 때만 불러온다 (상단 바를 가볍게)
    Promise.all([import('@utils/collab/withDatabase'), import('@pages/Docs/database/model')])
      .then(([{ default: withDatabase }, { readDatabase }]) =>
        withDatabase(socket, task.docId, me, (provider) => {
          const { properties } = readDatabase(provider.doc);
          const rows = provider.doc.getMap('rows');
          const row = rows.get(task.rowId) as { set: (k: string, v: unknown) => void } | undefined;
          if (!row) throw new Error('그 항목을 찾지 못했어요.');
          const status = properties.find((p) => p.type === 'status');
          const checkbox = properties.find((p) => p.type === 'checkbox');
          provider.doc.transact(() => {
            if (status?.options?.length) {
              const doneOption =
                status.options.find((o) => DONE_NAMES.includes(o.name.toLowerCase())) ||
                status.options[status.options.length - 1];
              row.set(status.id, done ? doneOption.id : status.options[0].id);
            }
            if (checkbox) row.set(checkbox.id, done);
          });
        }),
      )
      .then(() => toast.info(done ? '완료로 표시했어요.' : '다시 할 일로 돌렸어요.', { position: 'bottom-center' }))
      .catch((err: Error) => {
        mutate();
        toast.error(err.message, { position: 'bottom-center' });
      });
  };

  return (
    <TasksWrapper ref={wrapperRef}>
      <BellButton
        type="button"
        className={open ? 'active' : undefined}
        onClick={() => setOpen((v) => !v)}
        title="내 할 일"
        aria-label={urgent ? `내 할 일 (오늘까지·결재 대기 ${urgent}개)` : '내 할 일'}
        aria-expanded={open}
      >
        <ListTodo size={18} />
        {urgent > 0 && <span className="count">{urgent}</span>}
      </BellButton>
      {open && (
        <Dropdown role="dialog" aria-label="내 할 일">
          <header>
            <span>내 할 일</span>
            <button type="button" onClick={() => setShowDone((v) => !v)}>
              {showDone ? '끝난 일 숨기기' : '끝난 일 보기'}
            </button>
          </header>
          <List>
            {waiting.length > 0 && (
              <>
                <li className="section">결재 대기 {waiting.length}</li>
                {waiting.map((a) => (
                  <li key={`a${a.id}`}>
                    <FileCheck2 size={15} style={{ marginTop: 2, color: '#e8891d', flex: 'none' }} />
                    <button
                      type="button"
                      className="open"
                      onClick={() => {
                        setOpen(false);
                        setOpenApproval(a.id);
                      }}
                    >
                      <span className="title">{a.title}</span>
                      <span className="meta">
                        {KIND_LABELS[a.kind as ApprovalKind] || '결재'} · {a.requesterName} 님 요청 ·{' '}
                        {dayjs(a.createdAt).format('M/D HH:mm')}
                      </span>
                    </button>
                  </li>
                ))}
                <li className="section">할 일</li>
              </>
            )}
            {!shown.length && (
              <li className="empty">
                맡은 할 일이 없어요. 데이터베이스에서 담당자로 정해지거나, 메시지의 "작업물로 만들기 → 할 일"로 만들면
                여기에 모여요.
              </li>
            )}
            {shown.map((t) => (
              <li key={`${t.docId}-${t.rowId}`} className={t.done ? 'done' : undefined}>
                <input
                  type="checkbox"
                  checked={t.done}
                  onChange={() => toggleDone(t)}
                  aria-label={`${t.title} ${t.done ? '다시 할 일로' : '완료'}`}
                />
                <button
                  type="button"
                  className="open"
                  onClick={() => {
                    setOpen(false);
                    history.push(`/workspace/${workspace}/docs/d/${t.docId}?row=${encodeURIComponent(t.rowId)}`);
                  }}
                >
                  <span className="title">{t.title}</span>
                  <span className="meta">
                    {t.docTitle}
                    {t.statusName ? ` · ${t.statusName}` : ''}
                    {t.due && !t.done && <> · {dueLabel(t.due)}</>}
                  </span>
                </button>
              </li>
            ))}
          </List>
        </Dropdown>
      )}
      {openApproval !== null && (
        <Modal show onCloseModal={() => setOpenApproval(null)} title="결재">
          <ApprovalCard workspace={workspace} id={openApproval} />
        </Modal>
      )}
    </TasksWrapper>
  );
};

export default TasksButton;
