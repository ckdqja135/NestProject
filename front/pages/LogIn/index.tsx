import AuthLayout from '@components/AuthLayout';
import useInput from '@hooks/useInput';
import { Button, Error, Form, Input, Label, LinkContainer } from '@pages/SignUp/styles';
import fetcher from '@utils/fetcher';
import axios from 'axios';
import { AlertCircle, ArrowRight, Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { Link, Redirect } from 'react-router-dom';
import useSWR from 'swr';

// 회원가입 시 자동으로 들어가는 기본 워크스페이스
const DEFAULT_WORKSPACE = 'shlack';

const LogIn = () => {
  const { data: userData, error, mutate } = useSWR('/api/users', fetcher);
  const [logInError, setLogInError] = useState('');
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [email, onChangeEmail] = useInput('');
  const [password, onChangePassword] = useInput('');
  const onSubmit = useCallback(
    (e) => {
      e.preventDefault();
      if (loading) return;
      setLogInError('');
      setLoading(true);
      axios
        .post('/api/users/login', { email, password }, { withCredentials: true })
        .then(() => mutate())
        .catch((error) => {
          const status = error.response?.status;
          setAttempt((n) => n + 1);
          setLogInError(
            status === 401
              ? '이메일과 비밀번호 조합이 일치하지 않습니다.'
              : status === 429
              ? '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.'
              : '로그인하지 못했습니다. 잠시 후 다시 시도해주세요.',
          );
        })
        .finally(() => setLoading(false));
    },
    [email, password, mutate, loading],
  );

  if (!error && userData) {
    return <Redirect to={`/workspace/${userData.Workspaces?.[0]?.url ?? DEFAULT_WORKSPACE}/channel/일반`} />;
  }

  return (
    <AuthLayout title="다시 오신 걸 환영해요" subtitle="이메일로 로그인하세요.">
      <Form onSubmit={onSubmit}>
        <Label id="email-label">
          <span>이메일 주소</span>
          <div className="field">
            <Mail size={17} />
            <Input
              type="email"
              id="email"
              name="email"
              value={email}
              onChange={onChangeEmail}
              placeholder="name@work-email.com"
              autoComplete="email"
              autoFocus
              required
              aria-invalid={!!logInError}
            />
          </div>
        </Label>
        <Label id="password-label">
          <span>
            비밀번호
            <Link to="/forgot-password" className="forgot">
              비밀번호를 잊으셨나요?
            </Link>
          </span>
          <div className="field">
            <Lock size={17} />
            <Input
              type={showPassword ? 'text' : 'password'}
              id="password"
              name="password"
              value={password}
              onChange={onChangePassword}
              placeholder="비밀번호"
              autoComplete="current-password"
              required
              aria-invalid={!!logInError}
            />
            <button
              type="button"
              className="toggle"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </Label>
        {logInError && (
          <Error role="alert" key={attempt}>
            <AlertCircle size={16} />
            {logInError}
          </Error>
        )}
        <Button type="submit" disabled={loading}>
          {loading ? (
            <>
              <Loader2 size={17} className="spin" /> 로그인 중…
            </>
          ) : (
            <>
              로그인 <ArrowRight size={17} />
            </>
          )}
        </Button>
      </Form>
      <LinkContainer>
        아직 회원이 아니신가요? <Link to="/signup">회원가입</Link>
      </LinkContainer>
    </AuthLayout>
  );
};

export default LogIn;
