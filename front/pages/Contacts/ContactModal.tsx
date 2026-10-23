import Modal from '@components/Modal';
import { Actions, Field, FormError, TextInput } from '@components/ModalForm/styles';
import { IContact } from '@typings/db';
import getErrorMessage from '@utils/getErrorMessage';
import axios from 'axios';
import React, { FC, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { MemoInput, TwoColumns } from './styles';

interface Props {
  show: boolean;
  workspace: string;
  contact: IContact | null; // null 이면 새로 만들기
  onClose: () => void;
  onSaved: (contact: IContact) => void;
}

const FIELDS = ['name', 'company', 'department', 'jobTitle', 'email', 'phone', 'memo'] as const;
type Form = Record<(typeof FIELDS)[number], string>;
const EMPTY: Form = { name: '', company: '', department: '', jobTitle: '', email: '', phone: '', memo: '' };

// 외부 연락처 추가·수정
const ContactModal: FC<Props> = ({ show, workspace, contact, onClose, onSaved }) => {
  const [form, setForm] = useState<Form>(EMPTY);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (show) {
      setForm(contact ? (Object.fromEntries(FIELDS.map((k) => [k, contact[k] || ''])) as Form) : EMPTY);
      setError('');
    }
  }, [show, contact]);

  const set = (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('이름을 입력해 주세요.');
      return;
    }
    setSaving(true);
    setError('');
    const base = `/api/workspaces/${workspace}/contacts`;
    (contact ? axios.patch<IContact>(`${base}/${contact.id}`, form) : axios.post<IContact>(base, form))
      .then((res) => {
        toast.success(contact ? '연락처를 고쳤습니다.' : '연락처를 추가했습니다.', { position: 'bottom-center' });
        onSaved(res.data);
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setSaving(false));
  };

  return (
    <Modal
      show={show}
      onCloseModal={onClose}
      title={contact ? '연락처 수정' : '새 연락처'}
      description="워크스페이스 밖 사람(거래처, 고객 등)을 저장합니다. 나만 볼 수 있어요."
    >
      <form onSubmit={onSubmit}>
        <Field>
          <label htmlFor="contact-name">이름</label>
          <TextInput
            id="contact-name"
            value={form.name}
            maxLength={40}
            onChange={set('name')}
            aria-invalid={!!error && !form.name.trim()}
          />
        </Field>
        <Field>
          <label htmlFor="contact-company">회사</label>
          <TextInput id="contact-company" value={form.company} maxLength={60} onChange={set('company')} />
        </Field>
        <TwoColumns>
          <Field>
            <label htmlFor="contact-department">부서</label>
            <TextInput id="contact-department" value={form.department} maxLength={40} onChange={set('department')} />
          </Field>
          <Field>
            <label htmlFor="contact-job-title">직책</label>
            <TextInput id="contact-job-title" value={form.jobTitle} maxLength={40} onChange={set('jobTitle')} />
          </Field>
        </TwoColumns>
        <TwoColumns>
          <Field>
            <label htmlFor="contact-email">이메일</label>
            <TextInput id="contact-email" type="email" value={form.email} maxLength={100} onChange={set('email')} />
          </Field>
          <Field>
            <label htmlFor="contact-phone">전화번호</label>
            <TextInput id="contact-phone" type="tel" value={form.phone} maxLength={30} onChange={set('phone')} />
          </Field>
        </TwoColumns>
        <Field>
          <label htmlFor="contact-memo">메모</label>
          <MemoInput id="contact-memo" value={form.memo} maxLength={500} rows={3} onChange={set('memo')} />
        </Field>
        {error && <FormError role="alert">{error}</FormError>}
        <Actions>
          <button type="button" onClick={onClose}>
            취소
          </button>
          <button type="submit" className="primary" disabled={saving}>
            {saving ? '저장 중...' : '저장'}
          </button>
        </Actions>
      </form>
    </Modal>
  );
};

export default ContactModal;
