import { Mic, MicOff, MonitorUp, Phone, Volume2 } from 'lucide-react';
import { IUser } from '@typings/db';
import { avatarUrl } from '@utils/avatar';
import axios from 'axios';
import React, {
  createContext,
  FC,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { toast } from 'react-toastify';
import { Socket } from 'socket.io-client';
import { CallCard } from './styles';

// 1:1 통화(허들). 신호는 소켓으로 서버가 중계하고, 음성·화면은 WebRTC 로 두 브라우저가 직접 주고받는다.
type Phase = 'idle' | 'outgoing' | 'incoming' | 'connecting' | 'active';
interface Peer {
  id: number;
  nickname: string;
  email?: string;
  avatarStyle?: string | null;
}
interface CallSignal {
  type: 'invite' | 'accept' | 'decline' | 'busy' | 'signal' | 'hangup' | 'unavailable';
  from: number;
  fromName?: string;
  callId: string;
  data?: { description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };
}

const RING_TIMEOUT_MS = 30_000;
// 휴대폰 브라우저 등은 화면 공유를 지원하지 않는다
const canShareScreen = typeof navigator !== 'undefined' && 'getDisplayMedia' in (navigator.mediaDevices || {});

const CallContext = createContext<{ startCall: (peer: Peer) => void; inCall: boolean }>({
  startCall: () => undefined,
  inCall: false,
});
export const useCall = () => useContext(CallContext);

interface Props {
  socket?: Socket;
  members?: IUser[];
}

const CallProvider: FC<PropsWithChildren<Props>> = ({ socket, members, children }) => {
  const [phase, setPhase] = useState<Phase>('idle');
  const [peer, setPeer] = useState<Peer | null>(null);
  const [muted, setMuted] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [remoteVideo, setRemoteVideo] = useState<MediaStream | null>(null);
  const [seconds, setSeconds] = useState(0);

  // 콜백 안에서 최신 값을 쓰기 위한 ref
  const callIdRef = useRef<string | null>(null);
  const peerRef = useRef<Peer | null>(null);
  const phaseRef = useRef<Phase>('idle');
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenSenderRef = useRef<RTCRtpSender | null>(null);
  const politeRef = useRef(false);
  const makingOfferRef = useRef(false);
  const ignoreOfferRef = useRef(false);
  const ringTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const setPhaseBoth = (next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  };

  const send = useCallback(
    (type: CallSignal['type'], data?: CallSignal['data'], to = peerRef.current?.id, callId = callIdRef.current) => {
      if (socket && to && callId) {
        socket.emit('call', { type, to, callId, data });
      }
    },
    [socket],
  );

  const cleanup = useCallback(() => {
    if (ringTimerRef.current) {
      clearTimeout(ringTimerRef.current);
      ringTimerRef.current = null;
    }
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    screenSenderRef.current?.track?.stop();
    screenSenderRef.current = null;
    callIdRef.current = null;
    peerRef.current = null;
    setPeer(null);
    setMuted(false);
    setSharing(false);
    setRemoteVideo(null);
    setSeconds(0);
    setPhaseBoth('idle');
  }, []);

  const endCall = useCallback(
    (notify = true, message?: string) => {
      if (notify) {
        send('hangup');
      }
      cleanup();
      if (message) {
        toast.info(message, { position: 'bottom-center' });
      }
    },
    [send, cleanup],
  );

  // WebRTC 연결 만들기 (양쪽이 동시에 연결을 시작해도 꼬이지 않게 'perfect negotiation' 방식)
  const createConnection = useCallback(async () => {
    const { data: config } = await axios.get<RTCConfiguration>('/api/rtc-config');
    const pc = new RTCPeerConnection(config);
    pcRef.current = pc;
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        send('signal', { candidate: candidate.toJSON() });
      }
    };
    pc.onnegotiationneeded = async () => {
      try {
        makingOfferRef.current = true;
        await pc.setLocalDescription();
        send('signal', { description: pc.localDescription?.toJSON() });
      } catch (error) {
        console.error(error);
      } finally {
        makingOfferRef.current = false;
      }
    };
    pc.ontrack = ({ track, streams }) => {
      if (track.kind === 'audio' && audioRef.current) {
        audioRef.current.srcObject = streams[0] || new MediaStream([track]);
      }
      if (track.kind === 'video') {
        const stream = new MediaStream([track]);
        setRemoteVideo(stream);
        track.onended = () => setRemoteVideo(null);
        track.onmute = () => setRemoteVideo(null);
        track.onunmute = () => setRemoteVideo(stream);
      }
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setPhaseBoth('active');
      } else if (pc.connectionState === 'failed') {
        endCall(true, '통화 연결이 끊겼습니다.');
      }
    };
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    localStreamRef.current = stream;
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    return pc;
  }, [send, endCall]);

  const startCall = useCallback(
    (target: Peer) => {
      if (!socket || phaseRef.current !== 'idle') {
        return;
      }
      const callId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      callIdRef.current = callId;
      peerRef.current = target;
      politeRef.current = false; // 건 사람은 '양보하지 않는' 쪽
      setPeer(target);
      setPhaseBoth('outgoing');
      send('invite', undefined, target.id, callId);
      ringTimerRef.current = setTimeout(() => {
        if (phaseRef.current === 'outgoing') {
          endCall(true, `${target.nickname}님이 받지 않았습니다.`);
        }
      }, RING_TIMEOUT_MS);
    },
    [socket, send, endCall],
  );

  const accept = useCallback(async () => {
    if (ringTimerRef.current) {
      clearTimeout(ringTimerRef.current);
    }
    setPhaseBoth('connecting');
    send('accept');
    try {
      await createConnection();
    } catch (error) {
      endCall(true, `통화를 시작하지 못했습니다: ${(error as Error).message || '마이크를 쓸 수 없습니다.'}`);
    }
  }, [send, createConnection, endCall]);

  const decline = useCallback(() => {
    send('decline');
    cleanup();
  }, [send, cleanup]);

  // 상대가 보낸 신호 처리
  useEffect(() => {
    const onCall = async (signal: CallSignal) => {
      const current = callIdRef.current;
      if (signal.type === 'invite') {
        if (phaseRef.current !== 'idle') {
          // 이미 통화 중이면 바쁘다고 알린다
          send('busy', undefined, signal.from, signal.callId);
          return;
        }
        const member = members?.find((m) => m.id === signal.from);
        const caller: Peer = member || { id: signal.from, nickname: signal.fromName || '알 수 없음' };
        callIdRef.current = signal.callId;
        peerRef.current = caller;
        politeRef.current = true; // 받은 사람은 '양보하는' 쪽
        setPeer(caller);
        setPhaseBoth('incoming');
        ringTimerRef.current = setTimeout(() => {
          if (phaseRef.current === 'incoming') {
            cleanup();
          }
        }, RING_TIMEOUT_MS);
        return;
      }
      if (signal.callId !== current || signal.from !== peerRef.current?.id) {
        return;
      }
      switch (signal.type) {
        case 'accept':
          if (ringTimerRef.current) {
            clearTimeout(ringTimerRef.current);
          }
          setPhaseBoth('connecting');
          try {
            await createConnection();
          } catch (error) {
            endCall(true, `통화를 시작하지 못했습니다: ${(error as Error).message || '마이크를 쓸 수 없습니다.'}`);
          }
          break;
        case 'decline':
          endCall(false, `${peerRef.current?.nickname}님이 통화를 거절했습니다.`);
          break;
        case 'busy':
          endCall(false, `${peerRef.current?.nickname}님은 다른 통화 중입니다.`);
          break;
        case 'unavailable':
          endCall(false, '상대가 접속해 있지 않아 통화할 수 없습니다.');
          break;
        case 'hangup':
          endCall(false, '통화가 끝났습니다.');
          break;
        case 'signal': {
          const pc = pcRef.current;
          if (!pc || !signal.data) {
            return;
          }
          try {
            const { description, candidate } = signal.data;
            if (description) {
              const collision =
                description.type === 'offer' && (makingOfferRef.current || pc.signalingState !== 'stable');
              ignoreOfferRef.current = !politeRef.current && collision;
              if (ignoreOfferRef.current) {
                return;
              }
              await pc.setRemoteDescription(description);
              if (description.type === 'offer') {
                await pc.setLocalDescription();
                send('signal', { description: pc.localDescription?.toJSON() });
              }
            } else if (candidate) {
              try {
                await pc.addIceCandidate(candidate);
              } catch (error) {
                if (!ignoreOfferRef.current) {
                  throw error;
                }
              }
            }
          } catch (error) {
            console.error(error);
          }
          break;
        }
        default:
      }
    };
    socket?.on('call', onCall);
    return () => {
      socket?.off('call', onCall);
    };
  }, [socket, members, send, cleanup, createConnection, endCall]);

  // 통화 시간
  useEffect(() => {
    if (phase !== 'active') {
      return undefined;
    }
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  // 화면을 닫거나 다른 워크스페이스로 가면 통화를 끝낸다
  useEffect(() => {
    const onUnload = () => send('hangup');
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.removeEventListener('beforeunload', onUnload);
      if (phaseRef.current !== 'idle') {
        endCall(true);
      }
    };
  }, [send, endCall]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = remoteVideo;
    }
  }, [remoteVideo]);

  const toggleMute = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = muted;
      setMuted(!muted);
    }
  };

  const toggleShare = async () => {
    const pc = pcRef.current;
    if (!pc) {
      return;
    }
    if (screenSenderRef.current) {
      screenSenderRef.current.track?.stop();
      pc.removeTrack(screenSenderRef.current);
      screenSenderRef.current = null;
      setSharing(false);
      return;
    }
    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const [track] = screen.getVideoTracks();
      screenSenderRef.current = pc.addTrack(track, screen);
      setSharing(true);
      // 브라우저의 '공유 중지' 버튼으로 끝냈을 때
      track.onended = () => {
        if (screenSenderRef.current && pcRef.current) {
          pcRef.current.removeTrack(screenSenderRef.current);
          screenSenderRef.current = null;
          setSharing(false);
        }
      };
    } catch {
      // 사용자가 공유를 취소함
    }
  };

  const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  const peerAvatar = peer?.email ? avatarUrl(peer as { email: string; avatarStyle?: string | null }, 40) : undefined;

  return (
    <CallContext.Provider value={{ startCall, inCall: phase !== 'idle' }}>
      {children}
      <audio ref={audioRef} autoPlay />
      {peer && phase !== 'idle' && (
        <CallCard role="dialog" aria-label="통화">
          <div className="who">
            {peerAvatar && <img src={peerAvatar} alt="" />}
            <div>
              <strong>{peer.nickname}</strong>
              <small>
                {phase === 'incoming' && (
                  <>
                    <Phone size={12} /> 전화가 왔습니다
                  </>
                )}
                {phase === 'outgoing' && (
                  <>
                    <Phone size={12} /> 거는 중...
                  </>
                )}
                {phase === 'connecting' && '연결하는 중...'}
                {phase === 'active' && (
                  <>
                    <Volume2 size={12} /> 통화 중 {time}
                    {sharing ? ' · 화면 공유 중' : ''}
                  </>
                )}
              </small>
            </div>
          </div>
          {remoteVideo && <video ref={videoRef} autoPlay playsInline muted aria-label={`${peer.nickname}님의 화면`} />}
          <div className="actions">
            {phase === 'incoming' ? (
              <>
                <button type="button" className="accept" onClick={accept}>
                  받기
                </button>
                <button type="button" className="hangup" onClick={decline}>
                  거절
                </button>
              </>
            ) : (
              <>
                {phase === 'active' && (
                  <>
                    <button
                      type="button"
                      className={muted ? 'on' : undefined}
                      onClick={toggleMute}
                      aria-pressed={muted}
                    >
                      {muted ? (
                        <>
                          <MicOff size={14} /> 음소거됨
                        </>
                      ) : (
                        <>
                          <Mic size={14} /> 음소거
                        </>
                      )}
                    </button>
                    {canShareScreen && (
                      <button
                        type="button"
                        className={sharing ? 'on' : undefined}
                        onClick={toggleShare}
                        aria-pressed={sharing}
                      >
                        {sharing ? (
                          '공유 중지'
                        ) : (
                          <>
                            <MonitorUp size={14} /> 화면 공유
                          </>
                        )}
                      </button>
                    )}
                  </>
                )}
                <button type="button" className="hangup" onClick={() => endCall(true)}>
                  {phase === 'outgoing' ? '취소' : '끊기'}
                </button>
              </>
            )}
          </div>
        </CallCard>
      )}
    </CallContext.Provider>
  );
};

export default CallProvider;
