import { DOC_TYPE_INFO, DocType } from '@utils/docTemplates';
import React, { FC } from 'react';

// 문서 종류 아이콘 (SVG, 종류별 색)
const DocIcon: FC<{ type: DocType; size?: number }> = ({ type, size = 16 }) => {
  const { Icon, color } = DOC_TYPE_INFO[type] || DOC_TYPE_INFO.doc;
  return <Icon size={size} color={color} strokeWidth={2} aria-hidden="true" style={{ flex: 'none' }} />;
};

export default DocIcon;
