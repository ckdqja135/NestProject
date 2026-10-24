import styled from '@emotion/styled';

export const List = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 40vh;
  margin: 0 20px 8px;
  padding: 0;
  overflow-y: auto;
  list-style: none;

  & li {
    display: flex;
    gap: 10px;
    padding: 10px 12px;
    border: 1px solid rgba(91, 91, 240, 0.25);
    border-radius: 12px;
    background: linear-gradient(135deg, rgba(124, 92, 255, 0.08), rgba(61, 139, 253, 0.04)), var(--bg);
    font-size: 14px;
    animation: ephemeral-in 180ms ease-out;

    &.error {
      border-color: rgba(224, 30, 90, 0.35);
      background: var(--bg-danger);

      & .avatar {
        background: #e01e5a;
      }
    }
  }

  @keyframes ephemeral-in {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
  }

  & .avatar {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: 9px;
    background: linear-gradient(135deg, #7c5cff, #3d8bfd);
    color: #fff;
  }

  & .body {
    flex: 1;
    min-width: 0;
  }

  & header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 2px;
    font-size: 13px;

    & .pill {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      padding: 1px 7px;
      border-radius: 999px;
      background: rgba(91, 91, 240, 0.12);
      color: #5b5bf0;
      font-size: 11px;
      font-weight: 700;
    }

    & button {
      display: inline-flex;
      margin-left: auto;
      padding: 3px;
      border: none;
      border-radius: 50%;
      background: transparent;
      color: var(--text-muted);
      cursor: pointer;

      &:hover {
        background: var(--bg-hover);
      }
    }
  }

  & .text {
    white-space: pre-wrap;
    word-break: break-word;
  }
`;
