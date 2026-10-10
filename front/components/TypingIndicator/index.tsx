import styled from '@emotion/styled';
import React, { FC } from 'react';

const Wrapper = styled.div`
  height: 18px;
  padding: 0 20px;
  font-size: 12px;
  color: var(--text-muted);
`;

interface Props {
  names: string[];
}

// 입력 중인 사람 표시. 자리를 항상 차지해서 입력창이 들썩이지 않게 한다.
const TypingIndicator: FC<Props> = ({ names }) => {
  let text = '';
  if (names.length === 1) {
    text = `${names[0]}님이 입력 중...`;
  } else if (names.length === 2) {
    text = `${names[0]}님과 ${names[1]}님이 입력 중...`;
  } else if (names.length > 2) {
    text = `${names.length}명이 입력 중...`;
  }
  return <Wrapper aria-live="polite">{text}</Wrapper>;
};

export default TypingIndicator;
