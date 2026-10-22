import AuthLayout from '@components/AuthLayout';
import useInput from '@hooks/useInput';
import { Button, Error, Form, Input, Label, LinkContainer, Success } from '@pages/SignUp/styles';
import fetcher from '@utils/fetcher';
import axios from 'axios';
import { AlertCircle, ArrowRight, CheckCircle2, Eye, EyeOff, Loader2, Lock, Mail, User } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { Link, Redirect } from 'react-router-dom';
import useSWR from 'swr';

const SignUp = () => {
  const { data: userData, mutate } = useSWR('/api/users', fetcher);
  const [signUpError, setSignUpError] = useState('');
  const [signUpSuccess, setSignUpSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState(false);
  const [email, onChangeEmail] = useInput('');
  const [nickname, onChangeNickname] = useInput('');
  const [password, onChangePassword] = useInput('');
  const [passwordCheck, onChangePasswordCheck] = useInput('');

  const mismatchError = !!passwordCheck && password !== passwordCheck;
  const nicknameMissing = touched && !nickname.trim();

  const onSubmit = useCallback(
    (e) => {
      e.preventDefault();
      setTouched(true);
      if (loading || !nickname.trim() || password !== passwordCheck) return;
      setSignUpError('');
      setSignUpSuccess(false);
      setLoading(true);
      axios
        .post('/api/users', { email, nickname, password })
        .then(() => {
          setSignUpSuccess(true);
          // 가입하면 바로 로그인해서 워크스페이스로 보낸다 (실패하면 로그인 화면 안내만 남긴다)
          return axios
            .post('/api/users/login', { email, password }, { withCredentials: true })
            .then(() => mutate())
            .catch(() => undefined);
        })
        .catch((error) => {
          const res = error.response;
          setAttempt((n) => n + 1);
          setSignUpError(
            res?.data?.code === 403 || res?.status === 403
              ? '이미 가입된 이메일입니다.'
              : res?.status === 429
              ? '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.'
              : typeof res?.data?.data === 'string'
              ? res.data.data
              : '회원가입하지 못했습니다. 잠시 후 다시 시도해주세요.',
          );
        })
        .finally(() => setLoading(false));
    },
    [email, nickname, password, passwordCheck, loading, mutate],
  );

  if (userData) {
    return <Redirect to={`/workspace/${userData.Workspaces?.[0]?.url ?? 'shlack'}/channel/일반`} />;
  }

  return (
    <AuthLayout title="Shlack 시작하기" subtitle="몇 가지만 입력하면 바로 팀과 대화할 수 있어요.">
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
            />
          </div>
        </Label>
        <Label id="nickname-label">
          <span>닉네임</span>
          <div className="field">
            <User size={17} />
            <Input
              type="text"
              id="nickname"
              name="nickname"
              value={nickname}
              onChange={onChangeNickname}
              placeholder="팀원에게 보일 이름"
              autoComplete="nickname"
              aria-invalid={nicknameMissing}
            />
          </div>
          {nicknameMissing && <div className="hint bad">닉네임을 입력해주세요.</div>}
        </Label>
        <Label id="password-label">
          <span>비밀번호</span>
          <div className="field">
            <Lock size={17} />
            <Input
              type={showPassword ? 'text' : 'password'}
              id="password"
              name="password"
              value={password}
              onChange={onChangePassword}
              placeholder="비밀번호"
              autoComplete="new-password"
              required
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
        <Label id="password-check-label">
          <span>비밀번호 확인</span>
          <div className="field">
            <Lock size={17} />
            <Input
              type={showPassword ? 'text' : 'password'}
              id="password-check"
              name="password-check"
              value={passwordCheck}
              onChange={onChangePasswordCheck}
              placeholder="한 번 더 입력"
              autoComplete="new-password"
              required
              aria-invalid={mismatchError}
            />
          </div>
          {mismatchError && <div className="hint bad">비밀번호가 일치하지 않습니다.</div>}
          {!mismatchError && passwordCheck && <div className="hint good">비밀번호가 일치합니다.</div>}
        </Label>
        {signUpError && (
          <Error role="alert" key={attempt}>
            <AlertCircle size={16} />
            {signUpError}
          </Error>
        )}
        {signUpSuccess && (
          <Success role="status">
            <CheckCircle2 size={16} />
            회원가입되었습니다! 워크스페이스로 이동합니다.
          </Success>
        )}
        <Button type="submit" disabled={loading}>
          {loading ? (
            <>
              <Loader2 size={17} className="spin" /> 가입하는 중…
            </>
          ) : (
            <>
              회원가입 <ArrowRight size={17} />
            </>
          )}
        </Button>
      </Form>
      <LinkContainer>
        이미 회원이신가요? <Link to="/login">로그인</Link>
      </LinkContainer>
    </AuthLayout>
  );
};

export default SignUp;
