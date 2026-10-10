import Chat, { ChatActions } from '@components/Chat';
import { ChatZone, NewDivider, Section, StickyHeader } from '@components/ChatList/styles';
import { IChat, IDM } from '@typings/db';
import React, { FC, RefObject, useCallback } from 'react';
import { Scrollbars } from 'react-custom-scrollbars-2';

interface Props {
  scrollbarRef: RefObject<Scrollbars>;
  isReachingEnd?: boolean;
  isEmpty: boolean;
  chatSections: { [key: string]: (IDM | IChat)[] };
  setSize: (f: (size: number) => number) => Promise<(IDM | IChat)[][] | undefined>;
  myId?: number;
  actions?: ChatActions;
  intro?: React.ReactNode; // 첫 메시지까지 모두 불러왔을 때 맨 위에 보여줄 대화 시작 안내
  firstUnreadId?: number | null; // 이 메시지 위에 '새 메시지' 구분선을 그린다
}
const ChatList: FC<Props> = ({
  scrollbarRef,
  isReachingEnd,
  isEmpty,
  chatSections,
  setSize,
  myId,
  actions,
  intro,
  firstUnreadId,
}) => {
  const onScroll = useCallback(
    (values) => {
      if (values.scrollTop === 0 && !isReachingEnd && !isEmpty) {
        setSize((size) => size + 1).then(() => {
          scrollbarRef.current?.scrollTop(scrollbarRef.current?.getScrollHeight() - values.scrollHeight);
        });
      }
    },
    [setSize, scrollbarRef, isReachingEnd, isEmpty],
  );

  return (
    <ChatZone>
      <Scrollbars autoHide ref={scrollbarRef} onScrollFrame={onScroll}>
        {isReachingEnd && intro}
        {Object.entries(chatSections).map(([date, chats]) => {
          return (
            <Section className={`section-${date}`} key={date}>
              <StickyHeader>
                <button>{date}</button>
              </StickyHeader>
              {chats.map((chat) => (
                <React.Fragment key={chat.id}>
                  {chat.id === firstUnreadId && (
                    <NewDivider className="new-divider" role="separator" aria-label="여기부터 새 메시지">
                      <span>새 메시지</span>
                    </NewDivider>
                  )}
                  <Chat data={chat} myId={myId} actions={actions} />
                </React.Fragment>
              ))}
            </Section>
          );
        })}
      </Scrollbars>
    </ChatZone>
  );
};

export default ChatList;
