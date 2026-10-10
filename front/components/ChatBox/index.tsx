import {
  AttachButton,
  ChatArea,
  Form,
  MentionsTextarea,
  SendButton,
  Toolbox,
  EachMention,
} from '@components/ChatBox/styles';
import { IUser } from '@typings/db';
import autosize from 'autosize';
import { avatarUrl } from '@utils/avatar';
import React, { FC, useCallback, useEffect, useRef } from 'react';
import { Mention, SuggestionDataItem } from 'react-mentions';

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
}
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
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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

  const renderUserSuggestion: (
    suggestion: SuggestionDataItem,
    search: string,
    highlightedDisplay: React.ReactNode,
    index: number,
    focused: boolean,
  ) => React.ReactNode = useCallback(
    (member, search, highlightedDisplay, index, focus) => {
      if (!data) {
        return null;
      }
      return (
        <EachMention focus={focus}>
          <img src={avatarUrl(data[index], 20)} alt={data[index].nickname} />
          <span>{highlightedDisplay}</span>
        </EachMention>
      );
    },
    [data],
  );

  return (
    <ChatArea>
      <Form onSubmit={onSubmitForm} onPaste={onPaste}>
        <MentionsTextarea
          id={inputId}
          value={chat}
          onChange={onChangeChat}
          onKeyPress={onKeydownChat}
          placeholder={placeholder}
          inputRef={textareaRef}
          forceSuggestionsAboveCursor
        >
          <Mention
            appendSpaceOnAdd
            trigger="@"
            data={data?.map((v) => ({ id: v.id, display: v.nickname })) || []}
            renderSuggestion={renderUserSuggestion}
          />
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
