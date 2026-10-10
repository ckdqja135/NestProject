import Modal from '@components/Modal';
import styled from '@emotion/styled';
import React, { FC } from 'react';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = isMac ? '⌘' : 'Ctrl';

const SHORTCUTS: [string[], string][] = [
  [[MOD, 'K'], '빠른 이동 (채널·사람 찾아 가기)'],
  [[MOD, '/'], '키보드 단축키 보기'],
  [['↑'], '입력창이 비어 있을 때: 내 마지막 메시지 수정'],
  [['Esc'], '스레드·고정 메시지 패널 닫기, 수정 취소'],
  [['Enter'], '메시지 보내기'],
  [['Shift', 'Enter'], '줄 바꾸기'],
];

const Table = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;

  & li {
    display: flex;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid #f2f2f2;
    font-size: 14px;
  }

  & .keys {
    flex: 0 0 120px;
    display: flex;
    gap: 4px;
  }

  & kbd {
    padding: 2px 6px;
    border: 1px solid #ccc;
    border-bottom-width: 2px;
    border-radius: 4px;
    background: #f8f8f8;
    font-family: inherit;
    font-size: 12px;
  }
`;

interface Props {
  show: boolean;
  onCloseModal: () => void;
}

const ShortcutsModal: FC<Props> = ({ show, onCloseModal }) => (
  <Modal show={show} onCloseModal={onCloseModal} title="키보드 단축키">
    <Table>
      {SHORTCUTS.map(([keys, label]) => (
        <li key={label}>
          <span className="keys">
            {keys.map((key) => (
              <kbd key={key}>{key}</kbd>
            ))}
          </span>
          <span>{label}</span>
        </li>
      ))}
    </Table>
  </Modal>
);

export default ShortcutsModal;
