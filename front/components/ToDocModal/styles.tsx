import styled from '@emotion/styled';

// 고르기 칸 목록 (라디오·체크)
export const Checks = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;

  & label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    cursor: pointer;
  }
`;
