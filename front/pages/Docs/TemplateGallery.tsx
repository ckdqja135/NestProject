import Modal from '@components/Modal';
import { DOC_TEMPLATES, DOC_TYPE_INFO, DocTemplate, DocType } from '@utils/docTemplates';
import { WIKI_CATEGORIES } from '@utils/wikiTemplates';
import { Search } from 'lucide-react';
import React, { FC, useEffect, useMemo, useState } from 'react';
import { Gallery } from './styles';

interface Props {
  show: boolean;
  wikiOnly: boolean;
  onClose: () => void;
  onPick: (template: DocTemplate) => void;
}

interface Section {
  key: string;
  label: string;
  match: (t: DocTemplate) => boolean;
}

const TYPE_ORDER: DocType[] = ['doc', 'slides', 'sheet'];

// 템플릿 고르기: 왼쪽 분류, 위 검색, 오른쪽 카드
const TemplateGallery: FC<Props> = ({ show, wikiOnly, onClose, onPick }) => {
  const [query, setQuery] = useState('');
  const [section, setSection] = useState('all');
  useEffect(() => {
    if (show) {
      setQuery('');
      setSection('all');
    }
  }, [show]);

  const sections = useMemo<Section[]>(
    () => [
      { key: 'all', label: '전체', match: (t) => !wikiOnly || t.type === 'wiki' },
      ...(wikiOnly
        ? []
        : TYPE_ORDER.map((type) => ({
            key: type,
            label: DOC_TYPE_INFO[type].label,
            match: (t: DocTemplate) => t.type === type,
          }))),
      ...WIKI_CATEGORIES.map((category) => ({
        key: `wiki:${category}`,
        label: category,
        match: (t: DocTemplate) => t.type === 'wiki' && t.category === category,
      })),
    ],
    [wikiOnly],
  );
  const current = sections.find((s) => s.key === section) || sections[0];
  const keyword = query.trim().toLowerCase();
  const list = DOC_TEMPLATES.filter(
    (t) =>
      (keyword ? sections[0].match(t) : current.match(t)) &&
      (!keyword ||
        t.name.toLowerCase().includes(keyword) ||
        t.description.toLowerCase().includes(keyword) ||
        (t.category || '').includes(keyword)),
  );
  const count = (s: Section) => DOC_TEMPLATES.filter(s.match).length;

  return (
    <Modal show={show} onCloseModal={onClose} title="템플릿" width={860}>
      <Gallery>
        <div className="search">
          <Search size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && list[0]) onPick(list[0]);
            }}
            placeholder="템플릿 찾기 (예: 회의, 공지, 채용)"
            aria-label="템플릿 찾기"
          />
        </div>
        <div className="body">
          <nav aria-label="템플릿 분류">
            {sections.map((s, i) => (
              <React.Fragment key={s.key}>
                {!wikiOnly && s.key.startsWith('wiki:') && !sections[i - 1].key.startsWith('wiki:') && (
                  <div className="nav-group">위키</div>
                )}
                <button
                  type="button"
                  className={!keyword && current.key === s.key ? 'on' : undefined}
                  aria-pressed={!keyword && current.key === s.key}
                  onClick={() => {
                    setSection(s.key);
                    setQuery('');
                  }}
                >
                  {s.label}
                  <small>{count(s)}</small>
                </button>
              </React.Fragment>
            ))}
          </nav>
          <div className="grid" role="list">
            {list.length === 0 && <p className="empty">맞는 템플릿이 없습니다.</p>}
            {list.map((t) => (
              <button type="button" role="listitem" key={t.key} className="tpl" onClick={() => onPick(t)}>
                <span className="icon" style={{ ['--tpl' as string]: DOC_TYPE_INFO[t.type].color }}>
                  <t.Icon size={20} />
                </span>
                <span className="text">
                  <b>{t.name}</b>
                  <small>{t.description}</small>
                  <em>{t.type === 'wiki' ? `위키 · ${t.category}` : DOC_TYPE_INFO[t.type].label}</em>
                </span>
              </button>
            ))}
          </div>
        </div>
      </Gallery>
    </Modal>
  );
};

export default TemplateGallery;
