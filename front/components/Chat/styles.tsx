import styled from '@emotion/styled';

export const ChatWrapper = styled.div`
  display: flex;
  padding: 8px 20px;
  position: relative;

  &:hover {
    background: #eee;
  }

  &:hover .chat-actions {
    display: flex;
  }

  &.pinned {
    background: #fff8e1;
  }

  /* 검색 결과로 이동했을 때 잠깐 강조 */
  &.highlight {
    background: #fff3c4;
    transition: background 0.3s;
  }

  & .chat-img {
    display: flex;
    width: 36px;
    margin-right: 8px;

    & img {
      width: 36px;
      height: 36px;
    }
  }

  & .chat-text {
    display: flex;
    flex-wrap: wrap;
    flex: 1;
    min-width: 0;

    & p,
    & .message-body,
    & .attachment {
      flex: 0 0 100%;
      margin: 0;
      word-break: break-word;
    }

    /* 마크다운 */
    & .md-code {
      padding: 1px 4px;
      border: 1px solid #e3e3e3;
      border-radius: 3px;
      background: #f6f6f6;
      color: #c01343;
      font-family: Monaco, Menlo, Consolas, monospace;
      font-size: 12px;
    }

    & .md-pre {
      margin: 4px 0;
      padding: 8px 10px;
      border: 1px solid #e3e3e3;
      border-radius: 4px;
      background: #f8f8f8;
      font-family: Monaco, Menlo, Consolas, monospace;
      font-size: 12px;
      line-height: 1.5;
      white-space: pre;
      overflow-x: auto;
    }

    & .md-quote {
      margin: 4px 0;
      padding-left: 10px;
      border-left: 4px solid #ddd;
      color: #555;
    }
  }

  & .chat-user {
    display: flex;
    flex: 0 0 100%;
    align-items: center;

    & > b {
      margin-right: 5px;
    }

    & > span {
      font-size: 12px;
    }

    & > .edited {
      margin-left: 4px;
      color: #888;
    }
  }

  & a {
    text-decoration: none;
    color: deepskyblue;
  }
`;

export const ActionBar = styled.div`
  display: none;
  position: absolute;
  top: -12px;
  right: 20px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  z-index: 3;

  & > button {
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 16px;
    padding: 4px 6px;

    &:hover {
      background: #f2f2f2;
    }
  }
`;

export const EmojiPicker = styled.div`
  position: absolute;
  top: 32px;
  right: 0;
  display: flex;
  background: white;
  border: 1px solid #ddd;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  padding: 4px;

  & > button {
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 20px;
    padding: 2px 4px;
    border-radius: 4px;

    &:hover {
      background: #f2f2f2;
    }
  }
`;

export const ReactionList = styled.div`
  display: flex;
  flex: 0 0 100%;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;

  & > button {
    border: 1px solid #ddd;
    background: white;
    border-radius: 12px;
    padding: 1px 8px;
    font-size: 13px;
    cursor: pointer;

    &.mine {
      border-color: #1264a3;
      background: #e8f5fa;
      color: #1264a3;
    }
  }
`;

export const ReplyLink = styled.button`
  flex: 0 0 auto;
  margin-top: 4px;
  padding: 0;
  border: none;
  background: transparent;
  color: #1264a3;
  font-size: 13px;
  font-weight: bold;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
`;

export const PinnedLabel = styled.div`
  flex: 0 0 100%;
  font-size: 12px;
  color: #b7791f;
  margin-bottom: 2px;
`;

export const EditBox = styled.div`
  flex: 0 0 100%;

  & textarea {
    width: 100%;
    min-height: 60px;
    box-sizing: border-box;
    border: 1px solid #1264a3;
    border-radius: 4px;
    padding: 6px 8px;
    font: inherit;
    resize: vertical;
  }

  & > div {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 4px;

    & > span {
      flex: 1;
      font-size: 12px;
      color: #888;
    }
  }

  & button {
    border: 1px solid #ccc;
    background: white;
    border-radius: 4px;
    padding: 3px 10px;
    cursor: pointer;

    &.primary {
      background: #007a5a;
      border-color: #007a5a;
      color: white;
    }

    &:disabled {
      opacity: 0.5;
      cursor: default;
    }
  }
`;

export const ConfirmBox = styled.div`
  flex: 0 0 100%;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  padding: 6px 8px;
  background: #fdecea;
  border-radius: 4px;
  font-size: 13px;

  & > span {
    flex: 1;
  }

  & button {
    border: 1px solid #ccc;
    background: white;
    border-radius: 4px;
    padding: 2px 10px;
    cursor: pointer;

    &.danger {
      background: #e01e5a;
      border-color: #e01e5a;
      color: white;
    }
  }
`;
