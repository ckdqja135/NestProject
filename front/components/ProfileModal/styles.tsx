import styled from '@emotion/styled';

export const Section = styled.section`
  & + & {
    margin-top: 24px;
    padding-top: 20px;
    border-top: 1px solid var(--border);
  }

  & > h3 {
    margin: 0 0 14px;
    font-size: 16px;
  }
`;

export const AvatarGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
  gap: 8px;

  & > button {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 8px 4px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg);
    font-size: 12px;
    color: var(--text);
    cursor: pointer;

    &:hover {
      background: var(--bg-subtle);
    }

    &.selected {
      border-color: #1264a3;
      background: var(--bg-selected);
      box-shadow: 0 0 0 1px #1264a3;
    }

    & img {
      width: 48px;
      height: 48px;
      border-radius: 6px;
    }
  }
`;
