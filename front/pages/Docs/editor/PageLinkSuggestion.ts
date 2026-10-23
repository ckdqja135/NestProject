import { Extension } from '@tiptap/core';
import { ReactRenderer } from '@tiptap/react';
import { PluginKey } from '@tiptap/pm/state';
import Suggestion, { SuggestionOptions } from '@tiptap/suggestion';
import axios from 'axios';
import PageMenu, { PageItem, PageMenuHandle } from './PageMenu';

export interface PageLinkOptions {
  workspace: string;
  docId: number;
  // 새 페이지를 만들고 그 id·제목을 돌려준다
  createPage: (title: string) => Promise<PageItem | null>;
}

// '[[' 를 치면 문서를 찾아 페이지 링크를 넣는다 (없으면 새로 만들기)
const PageLinkSuggestion = Extension.create<PageLinkOptions>({
  name: 'pageLinkSuggestion',
  addOptions() {
    return { workspace: '', docId: 0, createPage: async () => null };
  },
  addProseMirrorPlugins() {
    const { workspace, docId, createPage } = this.options;
    const options: Omit<SuggestionOptions<PageItem>, 'editor'> = {
      char: '[[',
      allowSpaces: true,
      // 다른 목록('/' 블록 목록)과 구분되는 이름
      pluginKey: new PluginKey('pageLinkSuggestion'),
      allow: ({ state, range }) => !state.doc.resolve(range.from).parent.type.spec.code,
      items: async ({ query }) => {
        const q = query.trim();
        try {
          const { data } = await axios.get<{ id: number; title: string; type: string }[]>(
            `/api/workspaces/${workspace}/docs`,
            { params: { tab: 'all', q } },
          );
          const found = data.filter((d) => d.id !== docId).slice(0, 8);
          return q ? [...found, { id: null, title: q, type: 'doc' }] : found;
        } catch {
          return q ? [{ id: null, title: q, type: 'doc' }] : [];
        }
      },
      command: ({ editor, range, props }) => {
        const insert = (item: PageItem) =>
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertContent([
              { type: 'pageLink', attrs: { id: item.id, title: item.title, type: item.type } },
              { type: 'text', text: ' ' },
            ])
            .run();
        if (props.id !== null) {
          insert(props);
          return;
        }
        createPage(props.title).then((created) => created && insert(created));
      },
      render: () => {
        let renderer: ReactRenderer<PageMenuHandle> | null = null;
        const place = (rect: DOMRect | null | undefined) => {
          const el = renderer?.element as HTMLElement | undefined;
          if (!el || !rect) return;
          el.style.top = `${rect.bottom + 6 + window.scrollY}px`;
          el.style.left = `${Math.min(rect.left, window.innerWidth - 300) + window.scrollX}px`;
        };
        return {
          onStart: (props) => {
            renderer = new ReactRenderer(PageMenu, { props, editor: props.editor });
            const el = renderer.element as HTMLElement;
            el.style.position = 'absolute';
            el.style.zIndex = '1000';
            document.body.appendChild(el);
            place(props.clientRect?.());
          },
          onUpdate: (props) => {
            renderer?.updateProps(props);
            place(props.clientRect?.());
          },
          onKeyDown: ({ event }) => {
            if (event.key === 'Escape') {
              renderer?.element.remove();
              return true;
            }
            return renderer?.ref?.onKeyDown(event) ?? false;
          },
          onExit: () => {
            renderer?.element.remove();
            renderer?.destroy();
            renderer = null;
          },
        };
      },
    };
    return [Suggestion({ editor: this.editor, ...options })];
  },
});

export default PageLinkSuggestion;
