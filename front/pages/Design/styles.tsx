import styled from '@emotion/styled';
import { MOBILE } from '@utils/media';

export const Home = styled.div`
  height: calc(100vh - 38px);
  overflow-y: auto;
  padding: 20px 28px 40px;
  background: var(--bg);
  color: var(--text);
  box-sizing: border-box;

  ${MOBILE} {
    padding: 12px;
  }

  & > header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;

    & h2 {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
      margin: 0;
      font-size: 22px;
    }

    & .search {
      display: flex;
      align-items: center;
      gap: 6px;
      width: min(260px, 40vw);
      height: 34px;
      padding: 0 10px;
      border: 1px solid var(--border);
      border-radius: 8px;
      color: var(--text-muted);

      & input {
        flex: 1;
        min-width: 0;
        border: none;
        background: transparent;
        color: var(--text);
        font-size: 14px;
        outline: none;
      }
    }

    & .primary {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      height: 34px;
      padding: 0 14px;
      border: none;
      border-radius: 8px;
      background: #a259ff;
      color: white;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
    }
  }

  & section {
    margin-bottom: 28px;

    & h3 {
      margin: 0 0 12px;
      font-size: 15px;
    }
  }

  & .templates {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 14px;
  }

  & .tabs {
    display: flex;
    gap: 4px;
    margin-bottom: 14px;
    border-bottom: 1px solid var(--border);

    & button {
      padding: 8px 12px;
      border: none;
      border-bottom: 2px solid transparent;
      background: transparent;
      color: var(--text-muted);
      font-size: 14px;
      cursor: pointer;

      &.on {
        border-bottom-color: #a259ff;
        color: var(--text);
        font-weight: 700;
      }
    }
  }

  & .files {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 16px;
  }

  & .empty {
    color: var(--text-muted);
    font-size: 14px;
  }
`;

export const TemplateCard = styled.button`
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0 0 12px;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--bg);
  color: var(--text);
  text-align: left;
  cursor: pointer;

  &:hover {
    border-color: #a259ff;
    box-shadow: 0 4px 14px rgba(162, 89, 255, 0.15);
  }

  & svg {
    width: 100%;
    height: 110px;
    margin-bottom: 6px;
    background: #f1effa;
  }

  & b,
  & small {
    padding: 0 12px;
  }

  & b {
    font-size: 14px;
  }

  & small {
    color: var(--text-muted);
    font-size: 12px;
  }
`;

export const FileCard = styled.button`
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--bg);
  color: var(--text);
  text-align: left;
  cursor: pointer;

  &:hover {
    border-color: #a259ff;
  }

  & .thumb {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 130px;
    background: linear-gradient(135deg, #f1effa, #e8e4fb);
    color: #a259ff;
  }

  & .info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 10px 12px 12px;

    & b {
      overflow: hidden;
      font-size: 14px;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    & small {
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--text-muted);
      font-size: 12px;

      & img {
        width: 16px;
        height: 16px;
        border-radius: 50%;
      }
    }
  }
`;
