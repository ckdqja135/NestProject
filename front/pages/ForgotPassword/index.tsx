import AuthLayout from '@components/AuthLayout';
import useInput from '@hooks/useInput';
import { Button, Error, Form, Input, Label, LinkContainer, Success } from '@pages/SignUp/styles';
import axios from 'axios';
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, Mail } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';

// 비밀번호 찾기: 가입한 이메일로 재설정 링크를 보낸다
const ForgotPassword = () => {
  const [email, onChangeEmail] = useInput('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (loading) return;
      setLoading(true);
      setError('');
      axios
        .post('/api/users/password-reset', { email })
        .then(() => setSent(true))
        .catch((err) =>
          setError(
            err.response?.status === 429
              ? '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.'
              : '메일을 보내지 못했습니다. 잠시 후 다시 시도해주세요.',
          ),
        )
        .finally(() => setLoading(false));
    },
    [email, loading],
  );

  return (
    <AuthLayout title="비밀번호 찾기" subtitle="가입한 이메일로 비밀번호를 다시 정할 수 있는 링크를 보내 드려요.">
      {sent ? (
        <Success role="status">
          <CheckCircle2 size={16} />
          <span>
            <b>{email}</b> 로 가입되어 있다면 재설정 링크를 보냈어요. 메일함(스팸함도)을 확인해 주세요. 링크는 30분 동안
            쓸 수 있어요.
          </span>
        </Success>
      ) : (
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
          {error && (
            <Error role="alert">
              <AlertCircle size={16} />
              {error}
            </Error>
          )}
          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <Loader2 size={17} className="spin" /> 보내는 중…
              </>
            ) : (
              <>
                재설정 링크 받기 <ArrowRight size={17} />
              </>
            )}
          </Button>
        </Form>
      )}
      <LinkContainer>
        비밀번호가 생각나셨나요? <Link to="/login">로그인</Link>
      </LinkContainer>
    </AuthLayout>
  );
};

export default ForgotPassword;
