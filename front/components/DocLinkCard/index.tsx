import fetcher from '@utils/fetcher';
import {
  BookOpen,
  Database,
  FileSpreadsheet,
  FileText,
  Lock,
  LucideIcon,
  PenTool,
  Presentation,
  Shapes,
} from 'lucide-react';
import React, { FC } from 'react';
import useSWR from 'swr';
import { Card, CardBox } from './styles';

// 문서 종류별 아이콘 (Docs 화면의 것과 같은 색. 채팅 화면이 무거워지지 않게 여기에 따로 둔다)
const TYPES: Record<string, { Icon: LucideIcon; color: string; label: string }> = {
  doc: { Icon: FileText, color: '#2f80ed', label: '문서' },
  wiki: { Icon: BookOpen, color: '#7c5cd6', label: '위키' },
  slides: { Icon: Presentation, color: '#e8891d', label: '슬라이드' },
  sheet: { Icon: FileSpreadsheet, color: '#12a06b', label: '스프레드시트' },
  board: { Icon: Shapes, color: '#d64a9b', label: '화이트보드' },
  database: { Icon: Database, color: '#0f7b6c', label: '데이터베이스' },
  design: { Icon: PenTool, color: '#a259ff', label: '디자인' },
};

// 메시지 속 문서 링크를 카드로: 지금 제목·종류를 보여 주고, 볼 수 없으면 그렇게 알린다
const DocLinkCard: FC<{ workspace: string; id: number }> = ({ workspace, id }) => {
  const { data, error } = useSWR<{ id: number; title: string; type: string }>(
    `/api/workspaces/${workspace}/docs/${id}/title`,
    fetcher,
    { revalidateOnFocus: false, shouldRetryOnError: false, dedupingInterval: 30_000 },
  );
  if (error) {
    return (
      <CardBox className="doc-card denied" data-doc-card={id}>
        <span className="icon">
          <Lock size={16} />
        </span>
        <span className="text">
          <small>문서</small>
          <b>볼 수 없는 문서예요</b>
        </span>
        <span className="hint">만든 사람에게 공유를 부탁하세요</span>
      </CardBox>
    );
  }
  if (!data) {
    return <CardBox className="doc-card loading" aria-hidden="true" />;
  }
  const meta = TYPES[data.type] || TYPES.doc;
  return (
    <Card to={`/workspace/${workspace}/docs/d/${id}`} className="doc-card" data-doc-card={id}>
      <span className="icon" style={{ color: meta.color, background: `${meta.color}1f` }}>
        <meta.Icon size={18} />
      </span>
      <span className="text">
        <small>{meta.label}</small>
        <b>{data.title}</b>
      </span>
      <span className="open">열기 →</span>
    </Card>
  );
};

export default DocLinkCard;
