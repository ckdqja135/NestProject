import Modal from '@components/Modal';
import { Actions, Field, FormError, TextInput } from '@components/ModalForm/styles';
import { IDocFolder } from '@typings/db';
import getErrorMessage from '@utils/getErrorMessage';
import axios from 'axios';
import React, { FC, useEffect, useState } from 'react';
import { docsBase } from './api';

interface Props {
  show: boolean;
  workspace: string;
  folder?: IDocFolder; // 있으면 이름 바꾸기
  parentId?: number; // 새 폴더를 만들 위치
  onCloseModal: () => void;
  onDone: (folder: IDocFolder) => void;
}

const FolderModal: FC<Props> = ({ show, workspace, folder, parentId, onCloseModal, onDone }) => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (show) {
      setName(folder?.name || '');
      setError('');
    }
  }, [show, folder]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('폴더 이름을 입력해 주세요.');
      return;
    }
    const base = `${docsBase(workspace)}/doc-folders`;
    (folder
      ? axios.patch<IDocFolder>(`${base}/${folder.id}`, { name: trimmed })
      : axios.post<IDocFolder>(base, { name: trimmed, parentId })
    )
      .then((res) => {
        onCloseModal();
        onDone(res.data);
      })
      .catch((err) => setError(getErrorMessage(err)));
  };

  return (
    <Modal show={show} onCloseModal={onCloseModal} title={folder ? '폴더 이름 바꾸기' : '새 폴더'}>
      <form onSubmit={onSubmit}>
        {error && <FormError role="alert">{error}</FormError>}
        <Field>
          <label htmlFor="doc-folder-name">이름</label>
          <TextInput
            id="doc-folder-name"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 프로젝트 문서"
          />
        </Field>
        <Actions>
          <button type="button" onClick={onCloseModal}>
            취소
          </button>
          <button type="submit" className="primary">
            {folder ? '바꾸기' : '만들기'}
          </button>
        </Actions>
      </form>
    </Modal>
  );
};

export default FolderModal;
