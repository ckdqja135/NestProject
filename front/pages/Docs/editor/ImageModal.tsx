import Modal from '@components/Modal';
import { Actions, Field, FormError, TextInput } from '@components/ModalForm/styles';
import React, { FC, useEffect, useState } from 'react';

// 문서에 넣는 그림 하나의 최대 크기 (문서와 함께 모두에게 전달된다)
const MAX_IMAGE_BYTES = 1024 * 1024;

interface Props {
  show: boolean;
  onClose: () => void;
  onInsert: (src: string, alt: string) => void;
}

// 이미지 넣기: 주소를 쓰거나 작은 파일을 고른다
const ImageModal: FC<Props> = ({ show, onClose, onInsert }) => {
  const [url, setUrl] = useState('');
  const [alt, setAlt] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (show) {
      setUrl('');
      setAlt('');
      setError('');
    }
  }, [show]);

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('그림 파일만 넣을 수 있습니다.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError('1MB 보다 작은 그림만 넣을 수 있습니다. 큰 그림은 주소로 넣어 주세요.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onInsert(String(reader.result), alt || file.name);
    reader.readAsDataURL(file);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^https?:\/\//i.test(url.trim())) {
      setError('http:// 나 https:// 로 시작하는 주소를 써 주세요.');
      return;
    }
    onInsert(url.trim(), alt.trim());
  };

  return (
    <Modal show={show} onCloseModal={onClose} title="이미지 넣기">
      <form onSubmit={submit}>
        <Field>
          <label htmlFor="doc-image-url">이미지 주소</label>
          <TextInput id="doc-image-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
        </Field>
        <Field>
          <label htmlFor="doc-image-alt">설명 (선택)</label>
          <TextInput id="doc-image-alt" value={alt} onChange={(e) => setAlt(e.target.value)} />
        </Field>
        <Field>
          <label htmlFor="doc-image-file">또는 파일 고르기 (1MB 이하)</label>
          <input id="doc-image-file" type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0])} />
        </Field>
        {error && <FormError role="alert">{error}</FormError>}
        <Actions>
          <button type="button" onClick={onClose}>
            취소
          </button>
          <button type="submit" className="primary">
            넣기
          </button>
        </Actions>
      </form>
    </Modal>
  );
};

export default ImageModal;
