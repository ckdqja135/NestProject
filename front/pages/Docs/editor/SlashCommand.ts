import { Extension } from '@tiptap/core';
import { ReactRenderer } from '@tiptap/react';
import { PluginKey } from '@tiptap/pm/state';
import Suggestion, { SuggestionOptions } from '@tiptap/suggestion';
import SlashMenu, { SlashMenuHandle } from './SlashMenu';
import { filterSlashItems, SlashItem } from './slashItems';

// '/' 를 치면 블록 목록을 띄운다 (Notion 처럼)
const SlashCommand = Extension.create({
  name: 'slashCommand',
  addProseMirrorPlugins() {
    const options: Omit<SuggestionOptions<SlashItem>, 'editor'> = {
      char: '/',
      // 다른 목록('[[' 문서 링크)과 구분되는 이름
      pluginKey: new PluginKey('slashCommand'),
      // 코드 블록 안에서는 띄우지 않는다
      allow: ({ state, range }) => !state.doc.resolve(range.from).parent.type.spec.code,
      items: ({ query }) => filterSlashItems(query),
      command: ({ editor, range, props }) => props.run(editor, range),
      render: () => {
        let renderer: ReactRenderer<SlashMenuHandle> | null = null;
        const place = (rect: DOMRect | null | undefined) => {
          const el = renderer?.element as HTMLElement | undefined;
          if (!el || !rect) return;
          const below = rect.bottom + 6;
          const height = el.offsetHeight || 320;
          const top = below + height > window.innerHeight ? Math.max(8, rect.top - height - 6) : below;
          el.style.top = `${top + window.scrollY}px`;
          el.style.left = `${Math.min(rect.left, window.innerWidth - 300) + window.scrollX}px`;
        };
        return {
          onStart: (props) => {
            renderer = new ReactRenderer(SlashMenu, { props, editor: props.editor });
            const el = renderer.element as HTMLElement;
            el.classList.add('slash-menu-wrap');
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

export default SlashCommand;
