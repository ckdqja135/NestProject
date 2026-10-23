import useSocket from '@hooks/useSocket';
import getErrorMessage from '@utils/getErrorMessage';
import axios from 'axios';
import { Lock } from 'lucide-react';
import React, { FC, useEffect, useState } from 'react';
import { docsBase } from './api';
import { NoAccessBox } from './styles';

interface Props {
  workspace: string;
  docId: number;
  // 허락받으면 다시 불러온다
  onGranted: () => void;
}

// 링크로 열었는데 볼 권한이 없을 때: 문서가 있는지는 알리지 않고, 주인에게 권한을 요청할 수 있게 한다
const NoAccess: FC<Props> = ({ workspace, docId, onGranted }) => {
  const [socket] = useSocket(workspace);
  const [role, setRole] = useState<'view' | 'edit'>('view');
  const [message, setMessage] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'denied'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    const onDecided = (data: { id?: number; decision?: string }) => {
      if (data.id !== docId) return;
      if (data.decision === 'deny') setState('denied');
      else onGranted();
    };
    socket?.on('docAccess', onDecided);
    return () => {
      socket?.off('docAccess', onDecided);
    };
  }, [socket, docId, onGranted]);

  const send = () => {
    setState('sending');
    setError('');
    axios
      .post(`${docsBase(workspace)}/docs/${docId}/access-requests`, { role, message: message.trim() || undefined })
      .then(() => setState('sent'))
      .catch((err) => {
        setState('idle');
        setError(getErrorMessage(err));
      });
  };

  return (
    <NoAccessBox role="region" aria-label="문서 권한 없음">
      <Lock size={28} />
      <h2>이 문서를 볼 권한이 없어요</h2>
      <p>초대받았거나 권한을 받은 사람만 볼 수 있어요. 없는 문서일 수도 있어요.</p>
      {state === 'sent' ? (
        <p className="done" role="status">
          권한을 요청했어요. 문서 주인이 허락하면 바로 열려요.
        </p>
      ) : state === 'denied' ? (
        <p className="done" role="status">
          요청이 허락되지 않았어요.
        </p>
      ) : (
        <div className="request">
          <div className="roles" role="radiogroup" aria-label="요청할 권한">
            {(['view', 'edit'] as const).map((r) => (
              <label key={r} className={role === r ? 'on' : undefined}>
                <input type="radio" name="request-role" checked={role === r} onChange={() => setRole(r)} />
                {r === 'view' ? '보기 권한' : '편집 권한'}
              </label>
            ))}
          </div>
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={300}
            placeholder="문서 주인에게 남길 말 (선택)"
            aria-label="문서 주인에게 남길 말"
          />
          <button type="button" className="primary" onClick={send} disabled={state === 'sending'}>
            {state === 'sending' ? '보내는 중…' : '권한 요청'}
          </button>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </NoAccessBox>
  );
};

export default NoAccess;
