import Modal from '@components/Modal';
import { Actions, Field, FormError, TextInput } from '@components/ModalForm/styles';
import { IUser } from '@typings/db';
import { AVATAR_STYLES, avatarUrl } from '@utils/avatar';
import getErrorMessage from '@utils/getErrorMessage';
import axios from 'axios';
import React, { FC, useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { AvatarGrid, Section } from './styles';

interface Props {
  show: boolean;
  me: IUser;
  onCloseModal: () => void;
  onUpdated: () => void;
}

// 내 프로필 설정: 닉네임, 프로필 그림 모양, 비밀번호 변경
const ProfileModal: FC<Props> = ({ show, me, onCloseModal, onUpdated }) => {
  const [nickname, setNickname] = useState(me.nickname);
  const [avatarStyle, setAvatarStyle] = useState(me.avatarStyle || 'retro');
  const [profileError, setProfileError] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  // 열 때마다 현재 값으로 초기화
  useEffect(() => {
    if (show) {
      setNickname(me.nickname);
      setAvatarStyle(me.avatarStyle || 'retro');
      setProfileError('');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordError('');
    }
  }, [show, me.nickname, me.avatarStyle]);

  const trimmed = nickname.trim();
  const profileChanged = trimmed !== me.nickname || avatarStyle !== (me.avatarStyle || 'retro');

  const onSaveProfile = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!trimmed) {
        setProfileError('닉네임을 입력해 주세요.');
        return;
      }
      setSavingProfile(true);
      setProfileError('');
      axios
        .patch('/api/users/me', { nickname: trimmed, avatarStyle })
        .then(() => {
          toast.success('프로필을 저장했습니다.', { position: 'bottom-center' });
          onUpdated();
        })
        .catch((error) => setProfileError(getErrorMessage(error)))
        .finally(() => setSavingProfile(false));
    },
    [trimmed, avatarStyle, onUpdated],
  );

  const passwordMismatch = !!confirmPassword && newPassword !== confirmPassword;

  const onChangePassword = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (newPassword.length < 4) {
        setPasswordError('새 비밀번호는 4자 이상이어야 합니다.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setPasswordError('새 비밀번호가 서로 다릅니다.');
        return;
      }
      setSavingPassword(true);
      setPasswordError('');
      axios
        .post('/api/users/me/password', { currentPassword, newPassword })
        .then(() => {
          toast.success('비밀번호를 바꿨습니다.', { position: 'bottom-center' });
          setCurrentPassword('');
          setNewPassword('');
          setConfirmPassword('');
        })
        .catch((error) => setPasswordError(getErrorMessage(error)))
        .finally(() => setSavingPassword(false));
    },
    [currentPassword, newPassword, confirmPassword],
  );

  return (
    <Modal show={show} onCloseModal={onCloseModal} title="프로필 설정" description={me.email}>
      <Section>
        <form onSubmit={onSaveProfile}>
          <Field>
            <label htmlFor="profile-nickname">닉네임</label>
            <TextInput
              id="profile-nickname"
              value={nickname}
              maxLength={30}
              onChange={(e) => setNickname(e.target.value)}
              aria-invalid={!!profileError && !trimmed}
            />
          </Field>
          <Field>
            <label id="profile-avatar-label">프로필 그림</label>
            <AvatarGrid role="radiogroup" aria-labelledby="profile-avatar-label">
              {AVATAR_STYLES.map((style) => (
                <button
                  key={style.value}
                  type="button"
                  role="radio"
                  aria-checked={avatarStyle === style.value}
                  className={avatarStyle === style.value ? 'selected' : undefined}
                  onClick={() => setAvatarStyle(style.value)}
                >
                  <img src={avatarUrl(me, 48, style.value)} alt="" />
                  {style.label}
                </button>
              ))}
            </AvatarGrid>
            <p className="hint">Gravatar 에 사진을 등록한 이메일이면 등록한 사진이 우선 보입니다.</p>
          </Field>
          {profileError && <FormError role="alert">{profileError}</FormError>}
          <Actions style={{ marginTop: 0 }}>
            <button type="submit" className="primary" disabled={!profileChanged || savingProfile}>
              {savingProfile ? '저장 중...' : '프로필 저장'}
            </button>
          </Actions>
        </form>
      </Section>
      <Section>
        <h3>비밀번호 변경</h3>
        <form onSubmit={onChangePassword}>
          <Field>
            <label htmlFor="profile-current-password">현재 비밀번호</label>
            <TextInput
              id="profile-current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </Field>
          <Field>
            <label htmlFor="profile-new-password">새 비밀번호</label>
            <TextInput
              id="profile-new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </Field>
          <Field>
            <label htmlFor="profile-confirm-password">새 비밀번호 확인</label>
            <TextInput
              id="profile-confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              aria-invalid={passwordMismatch}
            />
            {passwordMismatch && <p className="error">새 비밀번호가 서로 다릅니다.</p>}
          </Field>
          {passwordError && <FormError role="alert">{passwordError}</FormError>}
          <Actions style={{ marginTop: 0 }}>
            <button
              type="submit"
              className="primary"
              disabled={!currentPassword || !newPassword || !confirmPassword || savingPassword}
            >
              {savingPassword ? '바꾸는 중...' : '비밀번호 변경'}
            </button>
          </Actions>
        </form>
      </Section>
    </Modal>
  );
};

export default ProfileModal;
