import styled from '@emotion/styled';

export const ChatZone = styled.div`
  width: 100%;
  display: flex;
  flex: 1;
`;

export const Section = styled.section`
  margin-top: 20px;
  border-top: 1px solid var(--border);
`;

export const StickyHeader = styled.div`
  display: flex;
  justify-content: center;
  flex: 1;
  width: 100%;
  position: sticky;
  top: 14px;

  & button {
    font-weight: bold;
    font-size: 13px;
    height: 28px;
    line-height: 27px;
    padding: 0 16px;
    z-index: 2;
    --saf-0: rgba(var(--sk_foreground_low, 29, 28, 29), 0.13);
    box-shadow: 0 0 0 1px var(--saf-0), 0 1px 3px 0 rgba(0, 0, 0, 0.08);
    border-radius: 24px;
    position: relative;
    top: -13px;
    background: var(--bg);
    border: none;
    outline: none;
  }
`;

// 들어오기 전에 읽지 않은 첫 메시지 위의 '새 메시지' 구분선
export const NewDivider = styled.div`
  display: flex;
  align-items: center;
  margin: 4px 20px;
  color: #e01e5a;
  font-size: 12px;
  font-weight: 700;

  &::before,
  &::after {
    content: '';
    flex: 1;
    border-top: 1px solid #e01e5a;
  }

  & > span {
    padding: 0 8px;
  }
`;
