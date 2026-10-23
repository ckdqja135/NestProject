import useSidebarPins from '@hooks/useSidebarPins';
import { useCall } from '@components/Call/CallProvider';
import { IContact, IUser, IUserGroup } from '@typings/db';
import { avatarUrl } from '@utils/avatar';
import getErrorMessage from '@utils/getErrorMessage';
import axios from 'axios';
import {
  ArrowUpToLine,
  CalendarPlus,
  CalendarCheck,
  Copy,
  Mail,
  MessageSquare,
  Pencil,
  Phone,
  PhoneCall,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import React, { FC, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { InitialAvatar } from './InitialAvatar';
import { Detail } from './styles';

const copy = (text: string, label: string) =>
  navigator.clipboard
    ?.writeText(text)
    .then(() => toast.success(`${label} 복사했습니다.`, { position: 'bottom-center' }))
    .catch(() => toast.error('복사하지 못했습니다.', { position: 'bottom-center' }));

const InfoRow: FC<{ label: string; value?: string | null; href?: string; copyLabel?: string }> = ({
  label,
  value,
  href,
  copyLabel,
}) =>
  value ? (
    <div className="row">
      <dt>{label}</dt>
      <dd>
        {href ? <a href={href}>{value}</a> : value}
        {copyLabel && (
          <button type="button" className="copy" onClick={() => copy(value, copyLabel)} aria-label={`${label} 복사`}>
            <Copy size={13} />
          </button>
        )}
      </dd>
    </div>
  ) : null;

interface MemberProps {
  kind: 'member';
  workspace: string;
  member: IUser;
  me: IUser;
  online: boolean;
  starred: boolean;
  following: boolean;
  groups: IUserGroup[];
  onToggleStar: () => void;
  onToggleFollow: () => void;
  onEditProfile: () => void;
  onClose: () => void;
}

interface ExternalProps {
  kind: 'external';
  workspace: string;
  contact: IContact;
  onToggleStar: () => void;
  onEdit: () => void;
  onDeleted: () => void;
  onClose: () => void;
}

// 연락처 오른쪽 상세: 동료(워크스페이스 멤버) 또는 외부 연락처
const ContactDetail: FC<MemberProps | ExternalProps> = (props) => {
  const { pins, setPinned } = useSidebarPins(props.workspace);
  const { startCall, inCall } = useCall();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const targetKey = props.kind === 'member' ? `m${props.member.id}` : `c${props.contact.id}`;
  useEffect(() => setConfirmDelete(false), [targetKey]);

  if (props.kind === 'member') {
    const { member, me, online, starred, following, groups, workspace } = props;
    const isMe = member.id === me.id;
    const pinned = pins.some((p) => p.kind === 'dm' && p.user?.id === member.id);
    const presence = online ? (member.away ? '자리 비움' : '온라인') : '오프라인';
    const myGroups = groups.filter((g) => g.Members.some((m) => m.UserId === member.id));
    return (
      <Detail aria-label={`${member.nickname} 연락처`}>
        <button type="button" className="close" onClick={props.onClose} aria-label="닫기">
          <X size={18} />
        </button>
        <div className="head">
          <span className="avatar-wrap">
            <img src={avatarUrl(member, 144)} alt="" className="avatar" />
            <i className={`presence ${online && !member.away ? 'on' : online ? 'away' : 'off'}`} title={presence} />
          </span>
          <h2>
            {member.nickname}
            {isMe && <small> (나)</small>}
            {(member.role === 'admin' || member.role === 'owner' || member.role === 'guest') && (
              <small className={`role-tag ${member.role}`}>
                {member.role === 'guest' ? '게스트' : member.role === 'owner' ? '소유자' : '관리자'}
              </small>
            )}
          </h2>
          {(member.department || member.jobTitle) && (
            <p className="meta">{[member.department, member.jobTitle].filter(Boolean).join(' · ')}</p>
          )}
          <p className="presence-text">
            {presence}
            {(member.statusEmoji || member.statusText) && (
              <>
                {' · '}
                {member.statusEmoji} {member.statusText}
              </>
            )}
          </p>
        </div>
        <div className="actions">
          <Link to={`/workspace/${workspace}/dm/${member.id}`} className="action primary">
            <MessageSquare size={16} /> {isMe ? '메모' : '메시지'}
          </Link>
          {!isMe && !member.bot && (
            <button
              type="button"
              className="action"
              onClick={() => startCall(member)}
              disabled={!online || inCall}
              title={online ? '음성 통화 (화면 공유 가능)' : '접속해 있지 않아 통화할 수 없습니다'}
            >
              <PhoneCall size={16} /> 통화
            </button>
          )}
          <a href={`mailto:${member.email}`} className="action">
            <Mail size={16} /> 메일
          </a>
          {member.phone && (
            <a href={`tel:${member.phone.replace(/[^0-9+]/g, '')}`} className="action">
              <Phone size={16} /> 전화
            </a>
          )}
          {!isMe && (
            <button
              type="button"
              className={`action${starred ? ' on' : ''}`}
              onClick={props.onToggleStar}
              aria-pressed={starred}
            >
              <Star size={16} fill={starred ? 'currentColor' : 'none'} /> 별표
            </button>
          )}
        </div>
        <dl className="info">
          <InfoRow label="이메일" value={member.email} href={`mailto:${member.email}`} copyLabel="이메일을" />
          <InfoRow
            label="전화"
            value={member.phone}
            href={member.phone ? `tel:${member.phone.replace(/[^0-9+]/g, '')}` : undefined}
            copyLabel="전화번호를"
          />
          <InfoRow label="부서" value={member.department} />
          <InfoRow label="직책" value={member.jobTitle} />
          {myGroups.length > 0 && (
            <div className="row">
              <dt>그룹</dt>
              <dd className="chips">
                {myGroups.map((g) => (
                  <span key={g.id} className="chip">
                    @{g.name}
                  </span>
                ))}
              </dd>
            </div>
          )}
        </dl>
        <div className="more">
          {isMe ? (
            <button type="button" onClick={props.onEditProfile}>
              <Pencil size={14} /> 내 연락처 정보 고치기
            </button>
          ) : (
            <>
              <button type="button" onClick={props.onToggleFollow} aria-pressed={following}>
                {following ? <CalendarCheck size={14} /> : <CalendarPlus size={14} />}{' '}
                {following ? '캘린더 구독 중 · 끊기' : '캘린더 구독하기'}
              </button>
              <button type="button" onClick={() => setPinned('dm', member.id, !pinned)} aria-pressed={pinned}>
                <ArrowUpToLine size={14} /> {pinned ? '사이드바 고정 풀기' : 'DM 을 사이드바 맨 위에 고정'}
              </button>
            </>
          )}
        </div>
      </Detail>
    );
  }

  const { contact, workspace } = props;
  const remove = () =>
    axios
      .delete(`/api/workspaces/${workspace}/contacts/${contact.id}`)
      .then(() => {
        toast.success('연락처를 지웠습니다.', { position: 'bottom-center' });
        props.onDeleted();
      })
      .catch((error) => toast.error(getErrorMessage(error), { position: 'bottom-center' }));
  const tel = contact.phone ? `tel:${contact.phone.replace(/[^0-9+]/g, '')}` : undefined;
  return (
    <Detail aria-label={`${contact.name} 연락처`}>
      <button type="button" className="close" onClick={props.onClose} aria-label="닫기">
        <X size={18} />
      </button>
      <div className="head">
        <InitialAvatar name={contact.name} size={72} />
        <h2>{contact.name}</h2>
        {(contact.company || contact.department || contact.jobTitle) && (
          <p className="meta">{[contact.company, contact.department, contact.jobTitle].filter(Boolean).join(' · ')}</p>
        )}
        <p className="presence-text">외부 연락처 · 나만 볼 수 있어요</p>
      </div>
      <div className="actions">
        {contact.email && (
          <a href={`mailto:${contact.email}`} className="action primary">
            <Mail size={16} /> 메일
          </a>
        )}
        {tel && (
          <a href={tel} className="action">
            <Phone size={16} /> 전화
          </a>
        )}
        <button
          type="button"
          className={`action${contact.starred ? ' on' : ''}`}
          onClick={props.onToggleStar}
          aria-pressed={contact.starred}
        >
          <Star size={16} fill={contact.starred ? 'currentColor' : 'none'} /> 별표
        </button>
        <button type="button" className="action" onClick={props.onEdit}>
          <Pencil size={16} /> 수정
        </button>
      </div>
      <dl className="info">
        <InfoRow label="회사" value={contact.company} />
        <InfoRow label="부서" value={contact.department} />
        <InfoRow label="직책" value={contact.jobTitle} />
        <InfoRow
          label="이메일"
          value={contact.email}
          href={contact.email ? `mailto:${contact.email}` : undefined}
          copyLabel="이메일을"
        />
        <InfoRow label="전화" value={contact.phone} href={tel} copyLabel="전화번호를" />
        {contact.memo && (
          <div className="row">
            <dt>메모</dt>
            <dd className="memo">{contact.memo}</dd>
          </div>
        )}
      </dl>
      <div className="more">
        {confirmDelete ? (
          <div className="confirm" role="alert">
            <span>이 연락처를 지울까요?</span>
            <button type="button" className="danger" onClick={remove}>
              지우기
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)}>
              취소
            </button>
          </div>
        ) : (
          <button type="button" className="danger-text" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={14} /> 연락처 지우기
          </button>
        )}
      </div>
    </Detail>
  );
};

export default ContactDetail;
