import AuthLayout from '@components/AuthLayout';
import useInput from '@hooks/useInput';
import { Button, Error, Form, Input, Label, LinkContainer, Success } from '@pages/SignUp/styles';
import getErrorMessage from '@utils/getErrorMessage';
import axios from 'axios';
import { AlertCircle, ArrowRight, CheckCircle2, Eye, EyeOff, Loader2, Lock } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

// 메일로 받은 링크로 들어와 새 비밀번호를 정한다
const ResetPassword = () => {
  const token = new URLSearchParams(useLocation().search).get('token') || '';
  const [password, onChangePassword] = useInput('');
  const [passwordCheck, onChangePasswordCheck] = useInput('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const mismatch = !!passwordCheck && password !== passwordCheck;
  const tooShort = !!password && password.length < 4;

  const onSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (loading || mismatch || tooShort) return;
      setLoading(true);
      setError('');
      axios
        .post('/api/users/password-reset/confirm', { token, password })
        .then(() => setDone(true))
        .catch((err) => setError(getErrorMessage(err)))
        .finally(() => setLoading(false));
    },
    [token, password, loading, mismatch, tooShort],
  );

  if (!token) {
    return (
      <AuthLayout title="링크가 올바르지 않아요" subtitle="메일에 있는 링크를 그대로 눌러 주세요.">
        <LinkContainer>
          <Link to="/forgot-password">재설정 링크 다시 받기</Link>
        </LinkContainer>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="새 비밀번호 정하기" subtitle="앞으로 로그인할 때 쓸 비밀번호를 입력해 주세요.">
      {done ? (
        <>
          <Success role="status">
            <CheckCircle2 size={16} />
            비밀번호를 바꿨어요. 새 비밀번호로 로그인해 주세요.
          </Success>
          <LinkContainer>
            <Link to="/login">로그인하러 가기</Link>
          </LinkContainer>
        </>
      ) : (
        <>
          <Form onSubmit={onSubmit}>
            <Label id="password-label">
              <span>새 비밀번호</span>
              <div className="field">
                <Lock size={17} />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={password}
                  onChange={onChangePassword}
                  placeholder="4자 이상"
                  autoComplete="new-password"
                  autoFocus
                  required
                  aria-invalid={tooShort}
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
              {tooShort && <div className="hint bad">4자 이상으로 정해 주세요.</div>}
            </Label>
            <Label id="password-check-label">
              <span>새 비밀번호 확인</span>
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
                  aria-invalid={mismatch}
                />
              </div>
              {mismatch && <div className="hint bad">비밀번호가 일치하지 않습니다.</div>}
            </Label>
            {error && (
              <Error role="alert">
                <AlertCircle size={16} />
                {error}
              </Error>
            )}
            <Button type="submit" disabled={loading || mismatch || tooShort}>
              {loading ? (
                <>
                  <Loader2 size={17} className="spin" /> 바꾸는 중…
                </>
              ) : (
                <>
                  비밀번호 바꾸기 <ArrowRight size={17} />
                </>
              )}
            </Button>
          </Form>
          <LinkContainer>
            <Link to="/forgot-password">재설정 링크 다시 받기</Link>
          </LinkContainer>
        </>
      )}
    </AuthLayout>
  );
};

export default ResetPassword;
