import Modal from '@components/Modal';
import { Actions, Field, FormError, TextInput } from '@components/ModalForm/styles';
import { GroupList } from '@components/GroupsModal/styles';
import useCustomEmojis from '@hooks/useCustomEmojis';
import { IUser } from '@typings/db';
import getErrorMessage from '@utils/getErrorMessage';
import axios from 'axios';
import React, { FC, useEffect, useState } from 'react';
import { toast } from 'react-toastify';

interface Props {
  show: boolean;
  workspace: string;
  me: IUser;
  isOwner: boolean;
  onCloseModal: () => void;
}

const NAME = /^[a-z0-9_-]{1,14}$/;
const MAX_BYTES = 128 * 1024;
const SIZE = 128;

// 그림을 data URL 로. 크면 128px 로 줄인다 (움직이는 GIF 는 줄이면 멈추므로 작을 때만 그대로)
const toDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('그림을 읽지 못했습니다.'));
    reader.onload = () => {
      const dataUrl = reader.result as string;
      if (file.size <= MAX_BYTES) {
        resolve(dataUrl);
        return;
      }
      const img = new Image();
      img.onerror = () => reject(new Error('그림을 읽지 못했습니다.'));
      img.onload = () => {
        const scale = Math.min(1, SIZE / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });

// 워크스페이스 전용 이모지: 메시지에 :이름: 으로 쓰거나 리액션으로 단다
const CustomEmojiModal: FC<Props> = ({ show, workspace, me, isOwner, onCloseModal }) => {
  const { emojis } = useCustomEmojis(show ? workspace : undefined);
  const [name, setName] = useState('');
  const [image, setImage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (show) {
      setName('');
      setImage('');
      setError('');
    }
  }, [show]);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) {
      return;
    }
    if (!/^image\/(png|gif|jpeg|webp)$/.test(file.type)) {
      setError('PNG, GIF, JPEG, WEBP 그림만 쓸 수 있습니다.');
      return;
    }
    setError('');
    toDataUrl(file)
      .then((url) => {
        setImage(url);
        if (!name) {
          setName(
            file.name
              .replace(/\.[^.]+$/, '')
              .toLowerCase()
              .replace(/[^a-z0-9_-]/g, '_')
              .slice(0, 14),
          );
        }
      })
      .catch((err) => setError(err.message));
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!NAME.test(name)) {
      setError('이름은 영문 소문자, 숫자, _, - 로 14자까지 쓸 수 있습니다.');
      return;
    }
    if (!image) {
      setError('그림을 골라 주세요.');
      return;
    }
    setBusy(true);
    axios
      .post(`/api/workspaces/${workspace}/emojis`, { name, image })
      .then(() => {
        toast.success(`:${name}: 이모지를 올렸습니다.`, { position: 'bottom-center' });
        setName('');
        setImage('');
        setError('');
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setBusy(false));
  };

  const onDelete = (id: number, emojiName: string) =>
    axios
      .delete(`/api/workspaces/${workspace}/emojis/${id}`)
      .then(() => toast.info(`:${emojiName}: 이모지를 지웠습니다.`, { position: 'bottom-center' }))
      .catch((err) => setError(getErrorMessage(err)));

  return (
    <Modal
      show={show}
      onCloseModal={onCloseModal}
      title="커스텀 이모지"
      description="메시지에 :이름: 으로 쓰거나 리액션으로 달 수 있는 이 워크스페이스만의 이모지입니다."
    >
      <GroupList>
        {!emojis && <li className="empty">불러오는 중...</li>}
        {emojis?.length === 0 && <li className="empty">아직 커스텀 이모지가 없습니다.</li>}
        {emojis?.map((emoji) => (
          <li key={emoji.id}>
            <div className="row">
              <img src={emoji.image} alt={`:${emoji.name}:`} style={{ width: 24, height: 24, objectFit: 'contain' }} />
              <span className="name">:{emoji.name}:</span>
              {(isOwner || emoji.CreatorId === me.id) && (
                <button type="button" className="danger" onClick={() => onDelete(emoji.id, emoji.name)}>
                  삭제
                </button>
              )}
            </div>
          </li>
        ))}
      </GroupList>
      <form onSubmit={onSubmit}>
        <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>새 이모지</h3>
        <Field>
          <label htmlFor="emoji-file">그림 (PNG·GIF·JPEG·WEBP, 128KB 넘으면 줄여서 올림)</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input id="emoji-file" type="file" accept="image/png,image/gif,image/jpeg,image/webp" onChange={onFile} />
            {image && <img src={image} alt="미리보기" style={{ width: 32, height: 32, objectFit: 'contain' }} />}
          </div>
        </Field>
        <Field>
          <label htmlFor="emoji-name">이름</label>
          <TextInput
            id="emoji-name"
            value={name}
            maxLength={14}
            placeholder="party_parrot"
            onChange={(e) => setName(e.target.value.toLowerCase())}
          />
          <p className="hint">메시지에 :{name || '이름'}: 으로 씁니다.</p>
        </Field>
        {error && <FormError role="alert">{error}</FormError>}
        <Actions>
          <button type="submit" className="primary" disabled={busy || !name || !image}>
            올리기
          </button>
        </Actions>
      </form>
    </Modal>
  );
};

export default CustomEmojiModal;
