import { MessageEdits } from '../entities/MessageEdits';

// 수정 내역을 처음 내용부터 지금 내용까지 시간 순서의 버전 목록으로 만든다.
// edits[i].content 는 i 번째 수정 직전 내용이고, edits[i].createdAt 은 그 수정 시각이다.
export function toVersions(
  message: { content: string; createdAt: Date },
  edits: Pick<MessageEdits, 'content' | 'createdAt'>[],
) {
  const contents = [...edits.map((e) => e.content), message.content];
  const times = [message.createdAt, ...edits.map((e) => e.createdAt)];
  return contents.map((content, index) => ({ content, at: times[index] }));
}
