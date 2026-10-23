import * as Y from 'yjs';

// 데이터베이스의 실시간 편집 상태(Yjs)에서 할 일 목록을 읽는다 (프론트 database/model.ts 와 같은 구조)
//   properties: Y.Array<Y.Map>  속성 { id, name, type, options }
//   rows:       Y.Map<Y.Map>    항목 id → 값들 (속성 id → 값, __createdAt)

export interface TaskRow {
  rowId: string;
  title: string;
  assignees: number[];
  due: string | null;
  statusName: string | null;
  done: boolean;
  createdAt: number;
}

const DONE_NAMES = ['완료', '끝', '종료', 'done', 'complete', 'completed'];

interface Prop {
  id: string;
  name: string;
  type: string;
  options?: { id: string; name: string }[];
}

export const readTasks = (ydoc: Y.Doc): TaskRow[] => {
  const props = ydoc
    .getArray<Y.Map<unknown>>('properties')
    .toArray()
    .map((p) => p.toJSON() as Prop);
  const first = (type: string) => props.find((p) => p.type === type);
  const titleProp = first('title');
  const person = first('person');
  const date = first('date');
  const status = first('status');
  const checkbox = first('checkbox');
  if (!person) return [];
  const rows: TaskRow[] = [];
  ydoc.getMap<Y.Map<unknown>>('rows').forEach((row, rowId) => {
    const values = row.toJSON() as Record<string, unknown>;
    const rawPeople = values[person.id];
    const assignees = (
      Array.isArray(rawPeople) ? rawPeople : rawPeople ? [rawPeople] : []
    )
      .map((v) => Number(v))
      .filter((v) => Number.isInteger(v) && v > 0);
    if (!assignees.length) return;
    const statusId = status ? values[status.id] : null;
    const statusName =
      (status && status.options?.find((o) => o.id === statusId)?.name) || null;
    const due =
      date && typeof values[date.id] === 'string'
        ? (values[date.id] as string)
        : null;
    rows.push({
      rowId,
      title: String((titleProp && values[titleProp.id]) || '제목 없음').slice(
        0,
        300,
      ),
      assignees: [...new Set(assignees)],
      due: due && /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : null,
      statusName,
      done:
        (!!statusName && DONE_NAMES.includes(statusName.toLowerCase())) ||
        (!!checkbox && values[checkbox.id] === true),
      createdAt: Number(values.__createdAt) || 0,
    });
  });
  return rows;
};
