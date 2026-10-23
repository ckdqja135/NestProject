import { Editor } from '@tiptap/core';

// 문서 안에서 이 스레드 표시가 붙은 글의 범위들
const rangesOf = (editor: Editor, threadId: string) => {
  const ranges: { from: number; to: number }[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.isText && node.marks.some((m) => m.type.name === 'comment' && m.attrs.threadId === threadId)) {
      ranges.push({ from: pos, to: pos + node.nodeSize });
    }
  });
  return ranges;
};

// 해결했거나 쓰지 않고 닫은 스레드의 표시를 지운다
export const removeCommentMark = (editor: Editor, threadId: string) => {
  const type = editor.schema.marks.comment;
  const ranges = rangesOf(editor, threadId);
  if (!type || !ranges.length || !editor.isEditable) return;
  const { tr } = editor.state;
  ranges.forEach(({ from, to }) => tr.removeMark(from, to, type));
  editor.view.dispatch(tr);
};

// 그 스레드가 달린 글로 화면을 옮긴다
export const scrollToThread = (editor: Editor, threadId: string) => {
  const [first] = rangesOf(editor, threadId);
  if (!first) return false;
  const { node } = editor.view.domAtPos(first.from + 1);
  const el = node.nodeType === 3 ? node.parentElement : (node as HTMLElement);
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  return true;
};

export const hasThreadMark = (editor: Editor, threadId: string) => rangesOf(editor, threadId).length > 0;
