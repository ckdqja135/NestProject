import { mergeAttributes, Node } from '@tiptap/core';
import { NodeViewProps, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import fetcher from '@utils/fetcher';
import React, { FC } from 'react';
import { Link } from 'react-router-dom';
import useSWR from 'swr';
import DocIcon from '../DocIcon';

export const docHref = (workspace: string, id: number) => `/workspace/${workspace}/docs/d/${id}`;

// 페이지 링크: 지금 제목을 불러와 보여 준다 (제목이 바뀌어도 따라간다). 볼 수 없는 문서면 그렇게 알린다
const PageLinkView: FC<NodeViewProps> = ({ node, extension, selected }) => {
  const workspace = (extension.options as { workspace: string }).workspace;
  const id = Number(node.attrs.id);
  const { data, error } = useSWR<{ id: number; title: string; type: string }>(
    id ? `/api/workspaces/${workspace}/docs/${id}/title` : null,
    fetcher,
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );
  const title = data?.title || node.attrs.title || '제목 없음';
  return (
    <NodeViewWrapper as="span" className={`page-link${selected ? ' selected' : ''}`} data-page-link={id}>
      {error ? (
        <span className="page-link-missing" title="지워졌거나 볼 수 없는 문서입니다">
          볼 수 없는 문서
        </span>
      ) : (
        <Link to={docHref(workspace, id)} contentEditable={false} draggable={false}>
          <DocIcon type={(data?.type || node.attrs.type || 'doc') as 'doc'} size={14} />
          <span>{title}</span>
        </Link>
      )}
    </NodeViewWrapper>
  );
};

const PageLink = Node.create<{ workspace: string }>({
  name: 'pageLink',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: true,
  addOptions() {
    return { workspace: '' };
  },
  addAttributes() {
    return {
      id: { default: null },
      title: { default: '' },
      type: { default: 'doc' },
    };
  },
  parseHTML() {
    return [
      {
        tag: 'a[data-page-link]',
        getAttrs: (el) => ({
          id: Number((el as HTMLElement).getAttribute('data-page-link')),
          title: (el as HTMLElement).textContent,
        }),
      },
    ];
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      'a',
      mergeAttributes(HTMLAttributes, {
        'data-page-link': node.attrs.id,
        href: docHref(this.options.workspace, node.attrs.id),
      }),
      node.attrs.title,
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(PageLinkView);
  },
  // 검색·미리보기용 마크다운: [제목](/workspace/주소/docs/d/번호) (서버가 백링크를 이것으로 찾는다)
  addStorage() {
    const { workspace } = this.options;
    return {
      markdown: {
        serialize(state: { write: (text: string) => void }, node: { attrs: { id: number; title: string } }) {
          const title = (node.attrs.title || '제목 없음').replace(/[[\]]/g, '');
          state.write(`[${title}](${docHref(workspace, node.attrs.id)})`);
        },
        parse: {},
      },
    };
  },
});

export default PageLink;
