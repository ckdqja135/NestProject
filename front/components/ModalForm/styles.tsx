import styled from '@emotion/styled';

// 모달 안 폼 공통 스타일
export const Field = styled.div`
  margin-bottom: 18px;

  & > label {
    display: block;
    font-size: 15px;
    font-weight: 700;
    margin-bottom: 6px;
  }

  & > .hint {
    margin: 6px 0 0;
    font-size: 13px;
    color: var(--text-muted);
  }

  & > .error {
    margin: 6px 0 0;
    font-size: 13px;
    color: #e01e5a;
  }
`;

export const TextInput = styled.input`
  width: 100%;
  box-sizing: border-box;
  height: 40px;
  padding: 0 12px;
  font-size: 15px;
  border: 1px solid var(--border-strong);
  border-radius: 6px;
  outline: none;
  background: var(--bg);
  color: var(--text);
  transition: border 80ms ease-out, box-shadow 80ms ease-out;

  &:focus {
    border-color: #1264a3;
    box-shadow: 0 0 0 3px rgba(29, 155, 209, 0.3);
  }

  &[aria-invalid='true'] {
    border-color: #e01e5a;
    box-shadow: none;
  }
`;

// 입력칸 앞에 고정 텍스트(접두어)를 붙인 입력 그룹
export const InputGroup = styled.div`
  display: flex;
  align-items: stretch;
  border: 1px solid var(--border-strong);
  border-radius: 6px;
  overflow: hidden;
  transition: border 80ms ease-out, box-shadow 80ms ease-out;

  &:focus-within {
    border-color: #1264a3;
    box-shadow: 0 0 0 3px rgba(29, 155, 209, 0.3);
  }

  &.invalid {
    border-color: #e01e5a;
    box-shadow: none;
  }

  & > span {
    display: flex;
    align-items: center;
    padding: 0 4px 0 12px;
    background: var(--bg-subtle);
    color: var(--text-muted);
    font-size: 14px;
    white-space: nowrap;
  }

  & > input {
    flex: 1;
    min-width: 0;
    height: 40px;
    border: none;
    outline: none;
    padding: 0 12px 0 4px;
    font-size: 15px;
    background: var(--bg-subtle);
  }

  & > input:focus {
    background: var(--bg);
  }
`;

export const ChoiceList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;

  & > label {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    padding: 12px 14px;
    border: 1px solid var(--border);
    border-radius: 8px;
    cursor: pointer;

    &:hover {
      background: var(--bg-subtle);
    }

    &.selected {
      border-color: #1264a3;
      background: var(--bg-selected);
    }

    & input {
      margin: 3px 0 0;
    }

    & strong {
      display: block;
      font-size: 15px;
    }

    & small {
      display: block;
      margin-top: 2px;
      color: var(--text-muted);
      font-size: 13px;
    }
  }
`;

export const FormError = styled.p`
  margin: 0 0 16px;
  padding: 10px 12px;
  border-radius: 6px;
  background: var(--bg-danger);
  color: #b0123d;
  font-size: 14px;
`;

export const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 24px;

  & > button {
    height: 36px;
    padding: 0 16px;
    border-radius: 6px;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    border: 1px solid var(--border-strong);
    background: var(--bg);
    color: var(--text);

    &:hover {
      background: var(--bg-subtle);
    }

    &.primary {
      border-color: #007a5a;
      background: #007a5a;
      color: white;

      &:hover {
        background: #148567;
      }
    }

    &:disabled,
    &.primary:disabled {
      opacity: 0.5;
      cursor: default;
    }
  }
`;
