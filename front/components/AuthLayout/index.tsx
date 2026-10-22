import { AuthPage, Brand, Card, Header, Panel } from '@pages/SignUp/styles';
import { CalendarDays, FileText, MessagesSquare } from 'lucide-react';
import React, { FC } from 'react';

interface Props {
  title: string;
  subtitle: string;
}

export const Logo: FC<{ size?: number }> = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
    <rect width="32" height="32" rx="9" fill="#fff" fillOpacity="0.14" />
    <path
      d="M12 7.5 10 24.5M21.5 7.5l-2 17M8 12.5h17M7 19.5h17"
      stroke="#fff"
      strokeWidth="2.6"
      strokeLinecap="round"
    />
    <circle cx="25" cy="7" r="3.2" fill="#ecb22e" />
  </svg>
);

// 로그인·회원가입이 함께 쓰는 틀: 왼쪽 소개, 오른쪽 입력 카드
const AuthLayout: FC<Props> = ({ title, subtitle, children }) => (
  <AuthPage id="container">
    <Brand>
      <div className="logo">
        <Logo /> Shlack
      </div>
      <div className="intro">
        <h2>
          팀의 대화와 일을
          <br />한 곳에서.
        </h2>
        <p className="lead">채널에서 이야기하고, 문서와 일정을 바로 옆에서 함께 다룹니다.</p>
        <ul>
          <li>
            <span className="icon">
              <MessagesSquare size={18} />
            </span>
            채널·DM·스레드로 나누는 대화
          </li>
          <li>
            <span className="icon">
              <FileText size={18} />
            </span>
            문서·슬라이드·시트를 같이 편집
          </li>
          <li>
            <span className="icon">
              <CalendarDays size={18} />
            </span>
            팀 캘린더와 일정 알림
          </li>
        </ul>
      </div>
      <footer>© Shlack</footer>
    </Brand>
    <Panel>
      <Card>
        <Header>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </Header>
        {children}
      </Card>
    </Panel>
  </AuthPage>
);

export default AuthLayout;
