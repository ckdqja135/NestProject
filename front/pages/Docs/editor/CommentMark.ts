import { Mark, mergeAttributes } from '@tiptap/core';

// 댓글을 단 글에 칠하는 표시. 문서 안에 들어 있어서 글을 고쳐도 표시가 함께 움직이고, 모두에게 보인다
const CommentMark = Mark.create({
  name: 'comment',
  inclusive: false,
  excludes: '',
  addAttributes() {
    return { threadId: { default: null } };
  },
  parseHTML() {
    return [
      { tag: 'span[data-thread]', getAttrs: (el) => ({ threadId: (el as HTMLElement).getAttribute('data-thread') }) },
    ];
  },
  renderHTML({ HTMLAttributes, mark }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'comment-mark', 'data-thread': mark.attrs.threadId }), 0];
  },
  // 마크다운에는 표시 없이 글자만
  addStorage() {
    return {
      markdown: { serialize: { open: '', close: '', mixable: true, expelEnclosingWhitespace: true }, parse: {} },
    };
  },
});

export default CommentMark;
