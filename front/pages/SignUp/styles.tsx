import { keyframes } from '@emotion/react';
import styled from '@emotion/styled';
import { MOBILE } from '@utils/media';

const rise = keyframes`from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none }`;
const spin = keyframes`to { transform: rotate(360deg) }`;
const shake = keyframes`
  20%, 60% { transform: translateX(-4px) }
  40%, 80% { transform: translateX(4px) }
`;

// 로그인·회원가입 화면: 왼쪽 소개 패널 + 오른쪽 입력 카드
export const AuthPage = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  min-height: 100vh;
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Pretendard', 'Noto Sans KR', 'Segoe UI',
    'Malgun Gothic', sans-serif;

  & input,
  & button {
    font-family: inherit;
  }

  ${MOBILE} {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }
`;

export const Brand = styled.aside`
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 48px 56px;
  overflow: hidden;
  color: #fff;
  background: radial-gradient(circle at 15% 20%, rgba(236, 178, 46, 0.25), transparent 40%),
    radial-gradient(circle at 85% 80%, rgba(54, 197, 240, 0.25), transparent 45%),
    linear-gradient(150deg, #4a154b 0%, #3f0e40 55%, #2c0a2d 100%);

  & .logo {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 22px;
    font-weight: 800;
    letter-spacing: -0.4px;
  }

  & h2 {
    margin: 0 0 14px;
    font-size: 40px;
    line-height: 1.2;
    font-weight: 800;
    letter-spacing: -1px;
  }

  & .lead {
    margin: 0 0 32px;
    max-width: 420px;
    font-size: 16px;
    line-height: 1.6;
    color: rgba(255, 255, 255, 0.78);
  }

  & ul {
    display: grid;
    gap: 14px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  & li {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 15px;
    color: rgba(255, 255, 255, 0.9);
  }

  & .icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.12);
    backdrop-filter: blur(4px);
  }

  & footer {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
  }

  ${MOBILE} {
    padding: 24px 20px;

    & .intro,
    & footer {
      display: none;
    }
  }
`;

export const Panel = styled.main`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;

  ${MOBILE} {
    align-items: flex-start;
    padding: 28px 16px 40px;
  }
`;

export const Card = styled.div`
  width: 100%;
  max-width: 400px;
  animation: ${rise} 0.35s ease-out;
`;

export const Header = styled.header`
  margin-bottom: 28px;

  & h1 {
    margin: 0 0 6px;
    font-size: 28px;
    font-weight: 800;
    letter-spacing: -0.6px;
    color: var(--text);
  }

  & p {
    margin: 0;
    font-size: 15px;
    color: var(--text-muted);
  }
`;

export const Form = styled.form`
  display: grid;
  gap: 18px;
`;

export const Label = styled.label`
  display: block;

  & > span {
    display: flex;
    justify-content: space-between;
    margin-bottom: 6px;
    font-size: 13px;
    font-weight: 700;
    color: var(--text);
    cursor: pointer;

    & .forgot {
      font-weight: 600;
      color: #1264a3;
      text-decoration: none;

      &:hover {
        text-decoration: underline;
      }
    }
  }

  & .field {
    position: relative;
    display: flex;
    align-items: center;

    & > svg {
      position: absolute;
      left: 13px;
      color: var(--text-faint);
      pointer-events: none;
      transition: color 120ms;
    }

    &:focus-within > svg {
      color: #1264a3;
    }
  }

  & .toggle {
    position: absolute;
    right: 6px;
    display: inline-flex;
    padding: 6px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--text-faint);
    cursor: pointer;

    &:hover {
      color: var(--text);
      background: var(--bg-hover);
    }
  }

  & .hint {
    margin-top: 6px;
    font-size: 12px;
    color: var(--text-muted);

    &.bad {
      color: #e01e5a;
    }

    &.good {
      color: #2eb67d;
    }
  }
`;

export const Input = styled.input`
  width: 100%;
  height: 46px;
  box-sizing: border-box;
  padding: 0 42px 0 40px;
  border: 1px solid var(--border-strong);
  border-radius: 10px;
  background: var(--bg);
  color: var(--text);
  font-size: 15px;
  outline: none;
  transition: border-color 120ms, box-shadow 120ms;

  &::placeholder {
    color: var(--text-faint);
  }

  &:hover {
    border-color: var(--text-faint);
  }

  &:focus {
    border-color: #1264a3;
    box-shadow: 0 0 0 4px rgba(29, 155, 209, 0.22);
  }

  &[aria-invalid='true'] {
    border-color: #e01e5a;

    &:focus {
      box-shadow: 0 0 0 4px rgba(224, 30, 90, 0.18);
    }
  }
`;

export const Button = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  height: 46px;
  margin-top: 4px;
  border: none;
  border-radius: 10px;
  background: linear-gradient(180deg, #611f69 0%, #4a154b 100%);
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2), 0 4px 14px rgba(74, 21, 75, 0.25);
  transition: transform 80ms, box-shadow 120ms, opacity 120ms;
  user-select: none;

  &:hover:not(:disabled) {
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2), 0 6px 20px rgba(74, 21, 75, 0.35);
  }

  &:active:not(:disabled) {
    transform: translateY(1px);
  }

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 4px rgba(29, 155, 209, 0.35);
  }

  &:disabled {
    opacity: 0.6;
    cursor: default;
  }

  & .spin {
    animation: ${spin} 0.8s linear infinite;
  }
`;

const Notice = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 10px;
  font-size: 13px;
  line-height: 1.45;

  & svg {
    margin-top: 1px;
  }
`;

export const Error = styled(Notice)`
  color: #e01e5a;
  background: var(--bg-danger);
  animation: ${shake} 0.35s ease-in-out;
`;

export const Success = styled(Notice)`
  color: #1e8a5a;
  background: rgba(46, 182, 125, 0.12);
`;

export const LinkContainer = styled.p`
  margin: 24px 0 0;
  font-size: 14px;
  text-align: center;
  color: var(--text-muted);

  & a {
    color: #1264a3;
    font-weight: 700;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
`;
