import Modal from '@components/Modal';
import { Actions, Field, FormError, TextInput } from '@components/ModalForm/styles';
import useSocket from '@hooks/useSocket';
import { DATABASE_TEMPLATES } from '@pages/Docs/database/templates';
import {
  CellValue,
  DatabaseSeed,
  db,
  isEmpty,
  parseDatabaseSeed,
  readDatabase,
  seedDatabase,
  defaultSeed,
} from '@pages/Docs/database/model';
import { IDocListItem, IUser } from '@typings/db';
import withDatabase from '@utils/collab/withDatabase';
import { docUrl } from '@utils/docLinks';
import fetcher from '@utils/fetcher';
import getErrorMessage from '@utils/getErrorMessage';
import axios from 'axios';
import React, { FC, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import useSWR from 'swr';

// 메시지를 데이터베이스(할 일 관리)의 새 항목으로 넣는다 (채팅 → 할 일).
// 데이터베이스는 실시간 동시 편집 문서라, 잠깐 그 문서에 접속해 항목을 넣고 나온다.

const LAST_KEY = 'shlack-to-task-db';
const NEW_DB = 'new';

interface Props {
  show: boolean;
  workspace: string;
  me: IUser;
  members: IUser[];
  initialTitle: string;
  messageLink: string;
  // 만든 뒤 원래 대화에 남길 글 (null 이면 남기지 않는다)
  onCreated: (link: string, title: string) => Promise<unknown> | void;
  onClose: () => void;
}

const readLast = () => {
  try {
    return localStorage.getItem(LAST_KEY) || '';
  } catch {
    return '';
  }
};

const ToTaskModal: FC<Props> = ({ show, workspace, me, members, initialTitle, messageLink, onCreated, onClose }) => {
  const [socket] = useSocket(workspace);
  const { data: docs } = useSWR<IDocListItem[]>(show ? `/api/workspaces/${workspace}/docs?tab=all` : null, fetcher);
  const databases = useMemo(() => (docs || []).filter((d) => d.type === 'database'), [docs]);
  const [picked, setPicked] = useState<string>(() => readLast());
  const target = databases.some((d) => String(d.id) === picked)
    ? picked
    : databases[0]
    ? String(databases[0].id)
    : NEW_DB;
  const [title, setTitle] = useState(initialTitle);
  const [assignee, setAssignee] = useState(String(me.id));
  const [due, setDue] = useState('');
  const [leaveLink, setLeaveLink] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const people = members.filter((m) => !m.bot);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!socket || !title.trim() || pending) return;
    setPending(true);
    setError('');
    try {
      let docId = Number(target);
      let seed: DatabaseSeed | null = null;
      if (target === NEW_DB) {
        // 데이터베이스가 없으면 '할 일' 템플릿으로 만든다
        const content = DATABASE_TEMPLATES.tasks();
        const { data } = await axios.post<{ id: number }>(`/api/workspaces/${workspace}/docs`, {
          type: 'database',
          title: '할 일',
          content,
          visibility: 'private',
        });
        docId = data.id;
        seed = parseDatabaseSeed(content);
      }
      const rowId = await withDatabase(socket, docId, me, (provider) => {
        const doc = provider.doc;
        if (isEmpty(doc)) {
          // 새로 만든 데이터베이스: 처음 칸을 넣는다 (서버가 이 연결에 맡겼을 때만)
          if (!provider.shouldSeed) throw new Error('데이터베이스를 준비하는 중이에요. 잠시 뒤 다시 해 보세요.');
          seedDatabase(doc, seed || defaultSeed(), me.id);
          provider.seeded();
        }
        const { properties } = readDatabase(doc);
        const first = (type: string) => properties.find((p) => p.type === type);
        const values: Record<string, CellValue> = {};
        const titleProp = first('title');
        if (titleProp) values[titleProp.id] = title.trim();
        const person = first('person');
        if (person && assignee) values[person.id] = [assignee];
        const date = first('date');
        if (date && due) values[date.id] = due;
        const status = first('status');
        if (status?.options?.[0]) values[status.id] = status.options[0].id;
        // 원래 메시지 주소: 링크 칸이 있으면 거기에, 없으면 설명 칸에
        const linkProp = first('url') || properties.find((p) => p.type === 'text');
        if (linkProp) values[linkProp.id] = messageLink;
        return db.addRow(doc, values, me.id);
      });
      // 나만 보는 데이터베이스에 다른 사람을 담당자로 넣었으면, 그 사람도 보고 고칠 수 있게 공유한다
      const isPrivate = target === NEW_DB || databases.find((d) => d.id === docId)?.visibility === 'private';
      if (assignee && Number(assignee) !== me.id && isPrivate) {
        await axios
          .put(`/api/workspaces/${workspace}/docs/${docId}/shares`, { userId: Number(assignee), role: 'edit' })
          .catch(() => toast.info('담당자가 이 데이터베이스를 볼 수 있게 공유해 주세요.', { position: 'bottom-center' }));
      }
      try {
        localStorage.setItem(LAST_KEY, String(docId));
      } catch {
        // 다음에 고를 데이터베이스를 기억하지 못해도 괜찮다
      }
      const link = `${docUrl(workspace, docId)}?row=${rowId}`;
      if (leaveLink) await onCreated(link, title.trim());
      toast.success('할 일로 만들었어요.', { position: 'bottom-center' });
      onClose();
    } catch (err) {
      setError(err instanceof Error && !('isAxiosError' in err) ? err.message : getErrorMessage(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal
      show={show}
      onCloseModal={onClose}
      title="할 일로 만들기"
      description="데이터베이스에 새 항목으로 넣고, 원래 메시지 링크도 남겨요."
    >
      <form onSubmit={submit}>
        {error && <FormError role="alert">{error}</FormError>}
        <Field>
          <label htmlFor="to-task-title">할 일</label>
          <TextInput
            id="to-task-title"
            value={title}
            maxLength={200}
            autoFocus
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
        <Field>
          <label htmlFor="to-task-db">넣을 데이터베이스</label>
          <select id="to-task-db" className="select" value={target} onChange={(e) => setPicked(e.target.value)}>
            {databases.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
            <option value={NEW_DB}>＋ 새 '할 일' 데이터베이스 만들기</option>
          </select>
        </Field>
        <Field>
          <label htmlFor="to-task-owner">담당자 · 마감일</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <select
              id="to-task-owner"
              className="select"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              style={{ flex: 1 }}
            >
              <option value="">담당자 없음</option>
              {people.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nickname}
                  {m.id === me.id ? ' (나)' : ''}
                </option>
              ))}
            </select>
            <input
              type="date"
              className="select"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              aria-label="마감일"
              style={{ flex: 1 }}
            />
          </div>
        </Field>
        <Field>
          <label className="check-line">
            <input type="checkbox" checked={leaveLink} onChange={(e) => setLeaveLink(e.target.checked)} />
            원래 대화에 할 일 링크 남기기
          </label>
        </Field>
        <Actions>
          <button type="button" onClick={onClose}>
            취소
          </button>
          <button type="submit" className="primary" disabled={!title.trim() || pending || !socket}>
            {pending ? '넣는 중...' : '할 일 만들기'}
          </button>
        </Actions>
      </form>
    </Modal>
  );
};

export default ToTaskModal;
