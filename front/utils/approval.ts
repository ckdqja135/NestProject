// 결재 카드 메시지: approval:{"id":12,"t":"제목","n":"카드 위에 보일 한 줄"}

export interface ApprovalRef {
  id: number;
  t: string;
  n?: string;
}

export const parseApprovalContent = (content: string): ApprovalRef | null => {
  if (!content.startsWith('approval:')) return null;
  try {
    const value = JSON.parse(content.slice('approval:'.length));
    return Number.isInteger(value?.id) && typeof value.t === 'string' ? value : null;
  } catch {
    return null;
  }
};

export type ApprovalKind = 'general' | 'leave' | 'expense' | 'purchase';

export const KIND_LABELS: Record<ApprovalKind, string> = {
  general: '일반 결재',
  leave: '휴가 신청',
  expense: '지출 결의',
  purchase: '구매 요청',
};

export const STATUS_LABELS: Record<string, string> = {
  pending: '진행 중',
  approved: '승인',
  rejected: '반려',
  canceled: '취소',
};

// 종류별로 받는 칸
export const KIND_FIELDS: Record<
  ApprovalKind,
  { key: string; label: string; type: 'text' | 'date' | 'money' | 'select'; options?: string[] }[]
> = {
  general: [],
  leave: [
    {
      key: 'leaveType',
      label: '휴가 종류',
      type: 'select',
      options: ['연차', '오전 반차', '오후 반차', '병가', '경조사', '기타'],
    },
    { key: 'start', label: '시작일', type: 'date' },
    { key: 'end', label: '끝일', type: 'date' },
  ],
  expense: [
    { key: 'amount', label: '금액', type: 'money' },
    { key: 'purpose', label: '용도', type: 'text' },
  ],
  purchase: [
    { key: 'item', label: '품목', type: 'text' },
    { key: 'amount', label: '금액', type: 'money' },
    { key: 'quantity', label: '수량', type: 'text' },
  ],
};

export const formatMoney = (value: string) => {
  const n = Number(String(value).replace(/[^\d]/g, ''));
  return Number.isFinite(n) && n > 0 ? `₩${n.toLocaleString('ko-KR')}` : value;
};
