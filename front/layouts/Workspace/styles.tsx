import styled from '@emotion/styled';
import { MOBILE } from '@utils/media';

export const RightMenu = styled.div`
  float: right;
`;

export const Header = styled.header`
  height: 38px;
  background: #350d36;
  color: #ffffff;
  box-shadow: 0 1px 0 0 rgba(255, 255, 255, 0.1);
  padding: 5px;
  text-align: center;

  ${MOBILE} {
    /* 왼쪽 ☰ 버튼과 오른쪽 아이콘들 사이에 검색창 */
    text-align: left;
    padding-left: 44px;
  }
`;

// 휴대폰 화면에서 채널 목록(서랍)을 여닫는 버튼
export const NavToggle = styled.button`
  display: none;
  position: absolute;
  top: 4px;
  left: 6px;
  width: 32px;
  height: 30px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: white;
  font-size: 18px;
  cursor: pointer;

  &:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  ${MOBILE} {
    display: block;
  }
`;

// 서랍이 열렸을 때 나머지 화면을 어둡게 하고, 누르면 닫는다
export const NavBackdrop = styled.div`
  display: none;

  ${MOBILE} {
    display: block;
    position: fixed;
    inset: 38px 0 0 0;
    z-index: 49;
    background: rgba(0, 0, 0, 0.45);
  }
`;

export const ProfileImg = styled.img`
  width: 28px;
  height: 28px;
  position: absolute;
  top: 5px;
  right: 16px;
`;

export const WorkspaceWrapper = styled.div`
  display: flex;
  flex: 1;
`;

export const Workspaces = styled.div`
  width: 65px;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  background: #3f0e40;
  border-top: 1px solid rgb(82, 38, 83);
  border-right: 1px solid rgb(82, 38, 83);
  vertical-align: top;
  text-align: center;
  padding: 15px 0 0;

  ${MOBILE} {
    /* 휴대폰에서는 채널 목록 서랍과 함께 열린다 */
    position: fixed;
    top: 38px;
    left: 0;
    bottom: 0;
    z-index: 51;
    transform: translateX(-100%);
    transition: transform 0.2s ease-out;

    &.open {
      transform: none;
    }
  }
`;

export const Channels = styled.nav`
  width: 260px;
  display: inline-flex;
  flex-direction: column;
  background: #3f0e40;
  color: rgb(188, 171, 188);
  vertical-align: top;

  & a {
    padding-left: 36px;
    color: inherit;
    text-decoration: none;
    height: 28px;
    line-height: 28px;
    display: flex;
    align-items: center;

    &.selected {
      color: white;
    }

    /* 알림을 끈 채널은 흐리게 */
    &.muted-channel:not(.selected) {
      opacity: 0.6;
    }
  }

  & .draft-icon {
    margin-left: 4px;
    font-size: 11px;
  }

  & .muted-icon {
    margin-left: 4px;
    font-size: 11px;
  }

  & .status-emoji {
    margin-left: 4px;
    font-size: 13px;
  }

  & .bold {
    color: white;
    font-weight: bold;
  }

  & .count {
    margin-left: auto;
    background: #cd2553;
    border-radius: 16px;
    display: inline-block;
    font-size: 12px;
    font-weight: 700;
    height: 18px;
    line-height: 18px;
    padding: 0 9px;
    color: white;
    margin-right: 16px;
  }
  /* 멘션이 없는 단순 안 읽은 수는 눈에 덜 띄게 */
  & .count.muted {
    background: rgba(255, 255, 255, 0.25);
  }

  & h2 {
    height: 36px;
    line-height: 36px;
    margin: 0;
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
    font-size: 15px;
  }

  ${MOBILE} {
    position: fixed;
    top: 38px;
    left: 65px;
    bottom: 0;
    width: min(280px, calc(85vw - 65px));
    z-index: 50;
    transform: translateX(calc(-100% - 65px));
    transition: transform 0.2s ease-out;

    &.open {
      transform: none;
      box-shadow: 4px 0 16px rgba(0, 0, 0, 0.3);
    }
  }
`;

export const WorkspaceName = styled.button`
  height: 64px;
  line-height: 64px;
  border: none;
  width: 100%;
  text-align: left;
  border-top: 1px solid rgb(82, 38, 83);
  border-bottom: 1px solid rgb(82, 38, 83);
  font-weight: 900;
  font-size: 24px;
  background: transparent;
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
  padding: 0;
  padding-left: 16px;
  margin: 0;
  color: white;
  cursor: pointer;
`;

export const MenuScroll = styled.div`
  height: calc(100vh - 102px);
  overflow-y: auto;
`;

export const WorkspaceModal = styled.div`
  width: 280px;
  padding: 6px 0;
  text-align: left; /* 상단 바(text-align: center) 안에 들어가도 왼쪽 정렬 */

  & > header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px 14px;
    border-bottom: 1px solid var(--border);

    & .ws-icon {
      flex: 0 0 36px;
      width: 36px;
      height: 36px;
      border-radius: 8px;
      background: #4a154b;
      color: white;
      font-weight: 800;
      font-size: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    & .avatar {
      flex: 0 0 36px;
      width: 36px;
      height: 36px;
      border-radius: 8px;
      object-fit: cover;
    }

    & > div {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    & strong {
      font-size: 15px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    & small {
      font-size: 12px;
      color: var(--text-muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    & small.online {
      color: #007a5a;
    }

    & small.away {
      color: var(--text-muted);
    }

    & small.status {
      color: var(--text);
    }
  }

  & > ul {
    list-style: none;
    margin: 0;
    padding: 6px 0 0;
  }

  & li.divider {
    height: 1px;
    margin: 6px 0;
    background: var(--border);
  }

  & button {
    display: block;
    width: 100%;
    padding: 7px 24px;
    border: none;
    background: transparent;
    text-align: left;
    font-size: 15px;
    color: var(--text);
    cursor: pointer;

    &:hover,
    &:focus-visible {
      background: #1264a3;
      color: white;
      outline: none;
    }

    &.danger:hover,
    &.danger:focus-visible {
      background: #e01e5a;
    }
  }
`;

export const Chats = styled.div`
  flex: 1;
  min-width: 0;
`;

export const AddButton = styled.button`
  color: white;
  font-size: 24px;
  display: inline-block;
  width: 40px;
  height: 40px;
  background: transparent;
  border: none;
  border-radius: 10px;
  cursor: pointer;

  &:hover {
    background: rgba(255, 255, 255, 0.15);
  }
`;

export const WorkspaceButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: var(--bg);
  border: 3px solid #3f0e40;
  margin-bottom: 15px;
  font-size: 18px;
  font-weight: 700;
  color: black;
  cursor: pointer;
  opacity: 0.6;
  transition: opacity 100ms, box-shadow 100ms;

  &:hover {
    opacity: 1;
  }

  /* 현재 워크스페이스: 흰 테두리로 강조 */
  &.active {
    opacity: 1;
    box-shadow: 0 0 0 2px white;
  }
`;
