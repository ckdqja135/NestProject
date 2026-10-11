import {
  AttachButton,
  ChatArea,
  Form,
  MentionsTextarea,
  SendButton,
  Toolbox,
  EachMention,
  CommandHints,
  EmojiButtonWrap,
} from '@components/ChatBox/styles';
import { IUser } from '@typings/db';
import autosize from 'autosize';
import { avatarUrl } from '@utils/avatar';
import React, { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import EmojiPanel from '@components/EmojiPanel';
import { Mention, SuggestionDataItem } from 'react-mentions';
import { useParams } from 'react-router';
import useGroups from '@hooks/useGroups';
import { SlashCommand } from '@utils/slashCommands';

interface Props {
  onSubmitForm: (e: any) => void;
  chat?: string;
  onChangeChat: (e: any) => void;
  placeholder: string;
  data?: IUser[];
  inputId?: string;
  onAttachFiles?: (files: File[]) => void; // 있으면 파일 첨부 버튼과 붙여넣기 전송을 켠다
  uploading?: boolean;
  uploadProgress?: number;
  toolbarExtra?: React.ReactNode; // 첨부 버튼 옆에 추가할 도구 (예: GIF 검색)
  allowBroadcast?: boolean; // 채널이면 @channel / @here 멘션을 제안한다
  onEditLast?: () => void; // 입력창이 비어 있을 때 ↑ : 내 마지막 메시지 수정
  commands?: SlashCommand[]; // '/' 로 시작하면 쓸 수 있는 명령을 보여준다
}

// 채널 전체 멘션 (서버가 채널 멤버 모두 / 접속 중인 멤버에게 알린다)
const BROADCASTS = [
  { id: 'channel', display: 'channel', description: '채널 멤버 모두에게 알림' },
  { id: 'here', display: 'here', description: '지금 접속 중인 멤버에게 알림' },
];
const ChatBox: FC<Props> = ({
  onSubmitForm,
  chat,
  onChangeChat,
  placeholder,
  data,
  inputId = 'editor-chat',
  onAttachFiles,
  uploading,
  uploadProgress,
  toolbarExtra,
  allowBroadcast,
  onEditLast,
  commands,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const emojiRef = useRef<HTMLDivElement>(null);
  // 이모지 창 밖을 누르면 닫는다
  useEffect(() => {
    if (!showEmoji) {
      return undefined;
    }
    const onMouseDown = (e: MouseEvent) => {
      if (!emojiRef.current?.contains(e.target as Node)) {
        setShowEmoji(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && setShowEmoji(false);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [showEmoji]);
  // 채널에서는 사용자 그룹(@디자인팀)도 멘션할 수 있다
  const { workspace } = useParams<{ workspace?: string }>();
  const { data: groups } = useGroups(allowBroadcast ? workspace : undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onChangeFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      e.target.value = ''; // 같은 파일을 다시 고를 수 있게 초기화
      if (files.length) {
        onAttachFiles?.(files);
      }
    },
    [onAttachFiles],
  );

  // 클립보드의 파일(스크린샷, 복사한 이미지 등)을 붙여넣으면 바로 전송
  const onPaste = useCallback(
    (e: React.ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files || []);
      if (onAttachFiles && files.length) {
        e.preventDefault();
        onAttachFiles(files);
      }
    },
    [onAttachFiles],
  );
  useEffect(() => {
    if (textareaRef.current) {
      autosize(textareaRef.current);
    }
  }, []);

  const onKeydownChat = useCallback(
    (e) => {
      if (!e.nativeEvent.isComposing && e.key === 'Enter') {
        if (!e.shiftKey) {
          e.preventDefault();
          onSubmitForm(e);
        }
      }
    },
    [onSubmitForm],
  );

  const onKeyDownChat = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowUp' && !e.nativeEvent.isComposing && !chat?.trim() && onEditLast) {
        e.preventDefault();
        onEditLast();
      }
    },
    [chat, onEditLast],
  );

  const renderUserSuggestion: (
    suggestion: SuggestionDataItem,
    search: string,
    highlightedDisplay: React.ReactNode,
    index: number,
    focused: boolean,
  ) => React.ReactNode = useCallback(
    (member, search, highlightedDisplay, index, focus) => {
      const broadcast = BROADCASTS.find((b) => b.id === member.id);
      if (broadcast) {
        return (
          <EachMention focus={focus}>
            <span className="broadcast">📣</span>
            <span>{highlightedDisplay}</span>
            <small>{broadcast.description}</small>
          </EachMention>
        );
      }
      const group = groups?.find((g) => `g${g.id}` === member.id);
      if (group) {
        return (
          <EachMention focus={focus}>
            <span className="broadcast">👥</span>
            <span>{highlightedDisplay}</span>
            <small>그룹 · {group.Members.length}명</small>
          </EachMention>
        );
      }
      const user = data?.find((v) => v.id === member.id);
      if (!user) {
        return null;
      }
      return (
        <EachMention focus={focus}>
          <img src={avatarUrl(user, 20)} alt={user.nickname} />
          <span>{highlightedDisplay}</span>
        </EachMention>
      );
    },
    [data, groups],
  );

  // '/re' 처럼 명령을 치는 중이면 맞는 명령 목록
  const commandHints = useMemo(() => {
    const match = /^\/(\w*)$/.exec(chat || '');
    return match && commands ? commands.filter((c) => c.name.startsWith(match[1].toLowerCase())) : [];
  }, [chat, commands]);

  const suggestions = useMemo(
    () => [
      ...(data?.map((v) => ({ id: v.id, display: v.nickname })) || []),
      ...(allowBroadcast ? (groups || []).map((g) => ({ id: `g${g.id}`, display: g.name })) : []),
      ...(allowBroadcast ? BROADCASTS.map(({ id, display }) => ({ id, display })) : []),
    ],
    [data, allowBroadcast, groups],
  );

  return (
    <ChatArea>
      <Form onSubmit={onSubmitForm} onPaste={onPaste}>
        {commandHints.length > 0 && (
          <CommandHints role="listbox" aria-label="명령어">
            {commandHints.map((command) => (
              <li key={command.name}>
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => {
                    onChangeChat({ target: { value: `/${command.name} ` } });
                    textareaRef.current?.focus();
                  }}
                >
                  <b>/{command.name}</b>
                  <span>{command.description}</span>
                </button>
              </li>
            ))}
          </CommandHints>
        )}
        <MentionsTextarea
          id={inputId}
          value={chat}
          onChange={onChangeChat}
          onKeyPress={onKeydownChat}
          onKeyDown={onKeyDownChat}
          placeholder={placeholder}
          inputRef={textareaRef}
          forceSuggestionsAboveCursor
        >
          <Mention appendSpaceOnAdd trigger="@" data={suggestions} renderSuggestion={renderUserSuggestion} />
        </MentionsTextarea>
        <Toolbox>
          {onAttachFiles && (
            <>
              <AttachButton
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                aria-label="파일 첨부"
                title="파일 첨부 (이미지, 문서 등 20MB 이하)"
              >
                {uploading ? `보내는 중 ${uploadProgress ?? 0}%` : '＋ 파일'}
              </AttachButton>
              <input ref={fileInputRef} type="file" multiple hidden onChange={onChangeFile} />
            </>
          )}
          <EmojiButtonWrap ref={emojiRef}>
            <AttachButton
              type="button"
              aria-label="이모지 넣기"
              aria-expanded={showEmoji}
              title="이모지 넣기"
              onClick={() => setShowEmoji((v) => !v)}
            >
              😀
            </AttachButton>
            {showEmoji && (
              <div className="panel">
                <EmojiPanel
                  onPick={(emoji) => {
                    setShowEmoji(false);
                    // 커스텀 이모지(:이름:)는 앞뒤 글자와 붙지 않게 띄운다
                    const text = chat || '';
                    const insert = emoji.startsWith(':') && text && !/\s$/.test(text) ? ` ${emoji} ` : emoji;
                    onChangeChat({ target: { value: text + insert } });
                    textareaRef.current?.focus();
                  }}
                />
              </div>
            )}
          </EmojiButtonWrap>
          {toolbarExtra}
          <SendButton
            className={
              'c-button-unstyled c-icon_button c-icon_button--light c-icon_button--size_medium c-texty_input__button c-texty_input__button--send' +
              (chat?.trim() ? '' : ' c-texty_input__button--disabled')
            }
            data-qa="texty_send_button"
            aria-label="Send message"
            data-sk="tooltip_parent"
            type="submit"
            disabled={!chat?.trim()}
          >
            <i className="c-icon c-icon--paperplane-filled" aria-hidden="true" />
          </SendButton>
        </Toolbox>
      </Form>
    </ChatArea>
  );
};

export default ChatBox;
