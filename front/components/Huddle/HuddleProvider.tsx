import { IChannel, IUser } from '@typings/db';
import { getMediaSession, setMediaSession } from '@utils/mediaSession';
import axios from 'axios';
import React, {
  createContext,
  FC,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { toast } from 'react-toastify';
import { Socket } from 'socket.io-client';
import HuddleView from './HuddleView';
import { HuddleInfo, RemoteMedia } from './types';

// 채널 허들: 여러 명 음성·화상 통화. 서버는 누가 있는지와 연결 신호만 중계하고,
// 음성·영상은 참여자 브라우저끼리 직접 주고받는다 (모두가 서로 연결하는 메시 방식, 최대 6명).

interface Signal {
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

interface Peer {
  pc: RTCPeerConnection;
  joinedAt: number;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  senders: { camera?: RTCRtpSender; screen?: RTCRtpSender };
}

interface HuddleContextValue {
  huddles: Record<number, HuddleInfo>;
  current: number | null; // 내가 들어가 있는 허들의 채널 id
  join: (channelId: number) => void;
  leave: () => void;
  expand: () => void;
}

const HuddleContext = createContext<HuddleContextValue>({
  huddles: {},
  current: null,
  join: () => undefined,
  leave: () => undefined,
  expand: () => undefined,
});
export const useHuddle = () => useContext(HuddleContext);

const SPEAKING_LEVEL = 0.035;

interface Props {
  socket?: Socket;
  me?: IUser;
  members?: IUser[];
  channels?: IChannel[];
}

const HuddleProvider: FC<PropsWithChildren<Props>> = ({ socket, me, members, channels, children }) => {
  const [huddles, setHuddles] = useState<Record<number, HuddleInfo>>({});
  const [current, setCurrent] = useState<number | null>(null);
  const [joining, setJoining] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [muted, setMuted] = useState(false);
  const [noMic, setNoMic] = useState(false);
  const [camera, setCamera] = useState<MediaStream | null>(null);
  const [screen, setScreen] = useState<MediaStream | null>(null);
  const [remote, setRemote] = useState<Record<number, RemoteMedia>>({});
  const [connected, setConnected] = useState<Set<number>>(new Set());
  const [speaking, setSpeaking] = useState<Set<number>>(new Set());

  const currentRef = useRef<number | null>(null);
  const meRef = useRef(me);
  meRef.current = me;
  const peersRef = useRef(new Map<number, Peer>());
  const rtcConfigRef = useRef<RTCConfiguration | undefined>(undefined);
  const micRef = useRef<MediaStream | null>(null);
  const cameraRef = useRef<MediaStream | null>(null);
  const screenRef = useRef<MediaStream | null>(null);
  const mutedRef = useRef(false);
  const joinTimerRef = useRef<number | null>(null);

  const emit = useCallback((data: Record<string, unknown>) => socket?.emit('huddle', data), [socket]);

  const sendState = useCallback(() => {
    emit({
      type: 'state',
      state: {
        muted: mutedRef.current,
        video: !!cameraRef.current,
        sharing: !!screenRef.current,
        cameraStream: cameraRef.current?.id ?? null,
        screenStream: screenRef.current?.id ?? null,
      },
    });
  }, [emit]);

  const closePeer = useCallback((userId: number) => {
    const peer = peersRef.current.get(userId);
    if (peer) {
      peer.pc.close();
      peersRef.current.delete(userId);
    }
    setRemote((prev) => {
      if (!(userId in prev)) return prev;
      const next = { ...prev };
      delete next[userId];
      return next;
    });
    setConnected((prev) => {
      if (!prev.has(userId)) return prev;
      const next = new Set(prev);
      next.delete(userId);
      return next;
    });
  }, []);

  // 내 마이크·카메라를 끄고 모든 연결을 닫는다
  const teardown = useCallback(() => {
    if (joinTimerRef.current) window.clearTimeout(joinTimerRef.current);
    Array.from(peersRef.current.keys()).forEach(closePeer);
    [micRef, cameraRef, screenRef].forEach((ref) => {
      ref.current?.getTracks().forEach((t) => t.stop());
      ref.current = null;
    });
    currentRef.current = null;
    mutedRef.current = false;
    setCurrent(null);
    setCamera(null);
    setScreen(null);
    setMuted(false);
    setNoMic(false);
    setExpanded(false);
    setJoining(false);
    setRemote({});
    setConnected(new Set());
    setSpeaking(new Set());
    if (getMediaSession() === 'huddle') setMediaSession(null);
  }, [closePeer]);

  const sendSignal = useCallback((to: number, data: Signal) => emit({ type: 'signal', to, data }), [emit]);

  // 다른 참여자 한 명과의 연결. 양쪽이 동시에 연결을 시작해도 꼬이지 않게 'perfect negotiation' 방식
  const createPeer = useCallback(
    (userId: number, joinedAt: number) => {
      const pc = new RTCPeerConnection(rtcConfigRef.current);
      const peer: Peer = {
        pc,
        joinedAt,
        polite: (meRef.current?.id ?? 0) > userId,
        makingOffer: false,
        ignoreOffer: false,
        senders: {},
      };
      peersRef.current.set(userId, peer);
      pc.onicecandidate = ({ candidate }) => {
        if (candidate) sendSignal(userId, { candidate: candidate.toJSON() });
      };
      pc.onnegotiationneeded = async () => {
        // 처음 연결은 한쪽(양보하지 않는 쪽)만 제안한다. 양쪽이 동시에 제안하면 양보한 쪽이
        // 되돌린 뒤 연결 후보를 모으지 않는 경우가 있다 (Chrome). 첫 연결 뒤의 변경(카메라 등)은 누구나 제안한다.
        if (peer.polite && !pc.remoteDescription) return;
        try {
          peer.makingOffer = true;
          await pc.setLocalDescription();
          sendSignal(userId, { description: pc.localDescription?.toJSON() });
        } catch (error) {
          console.error(error);
        } finally {
          peer.makingOffer = false;
        }
      };
      pc.ontrack = ({ track, streams }) => {
        const stream = streams[0] || new MediaStream([track]);
        setRemote((prev) => {
          const media: RemoteMedia = prev[userId] || { audio: null, videos: {} };
          const next =
            track.kind === 'audio'
              ? { ...media, audio: stream }
              : { ...media, videos: { ...media.videos, [stream.id]: stream } };
          return { ...prev, [userId]: next };
        });
        if (track.kind === 'video') {
          const drop = () =>
            setRemote((prev) => {
              const media = prev[userId];
              if (!media?.videos[stream.id]) return prev;
              const videos = { ...media.videos };
              delete videos[stream.id];
              return { ...prev, [userId]: { ...media, videos } };
            });
          track.onended = drop;
          stream.onremovetrack = () => {
            if (!stream.getVideoTracks().length) drop();
          };
        }
      };
      pc.onconnectionstatechange = () => {
        const ok = pc.connectionState === 'connected';
        setConnected((prev) => {
          if (prev.has(userId) === ok) return prev;
          const next = new Set(prev);
          if (ok) next.add(userId);
          else next.delete(userId);
          return next;
        });
        if (pc.connectionState === 'failed') {
          pc.restartIce();
        }
      };
      micRef.current?.getTracks().forEach((t) => pc.addTrack(t, micRef.current!));
      // 마이크가 없어도 상대 음성은 받는다
      if (!micRef.current) pc.addTransceiver('audio', { direction: 'recvonly' });
      const cam = cameraRef.current?.getVideoTracks()[0];
      if (cam) peer.senders.camera = pc.addTrack(cam, cameraRef.current!);
      const scr = screenRef.current?.getVideoTracks()[0];
      if (scr) peer.senders.screen = pc.addTrack(scr, screenRef.current!);
      return peer;
    },
    [sendSignal],
  );

  // 참여자 목록에 맞춰 연결을 만들거나 닫는다 (다시 들어온 사람은 새로 연결)
  const syncPeers = useCallback(
    (info: HuddleInfo) => {
      const myId = meRef.current?.id;
      const others = info.members.filter((m) => m.userId !== myId);
      others.forEach((m) => {
        const peer = peersRef.current.get(m.userId);
        if (peer && peer.joinedAt !== m.joinedAt) closePeer(m.userId);
        if (!peersRef.current.has(m.userId)) createPeer(m.userId, m.joinedAt);
      });
      Array.from(peersRef.current.keys())
        .filter((id) => !others.some((m) => m.userId === id))
        .forEach(closePeer);
    },
    [createPeer, closePeer],
  );

  const join = useCallback(
    async (channelId: number) => {
      if (!socket || joining) return;
      if (currentRef.current === channelId) {
        setExpanded(true);
        return;
      }
      if (getMediaSession() === 'call') {
        toast.info('통화를 끝낸 뒤에 허들에 들어갈 수 있습니다.', { position: 'bottom-center' });
        return;
      }
      if (currentRef.current !== null) {
        emit({ type: 'leave' });
        teardown();
      }
      setJoining(true);
      setMediaSession('huddle');
      try {
        if (!rtcConfigRef.current) {
          rtcConfigRef.current = (await axios.get<RTCConfiguration>('/api/rtc-config')).data;
        }
        try {
          micRef.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          setNoMic(false);
        } catch {
          micRef.current = null;
          setNoMic(true);
          toast.info('마이크를 쓸 수 없어 듣기만 합니다.', { position: 'bottom-center' });
        }
        emit({ type: 'join', channelId });
        // 서버가 받아 주지 않으면 (채널에서 나갔거나 연결이 끊김) 기다리지 않는다
        joinTimerRef.current = window.setTimeout(() => {
          if (currentRef.current === null) {
            teardown();
            toast.error('허들에 들어가지 못했습니다. 잠시 후 다시 시도해 주세요.', { position: 'bottom-center' });
          }
        }, 8000);
      } catch (error) {
        teardown();
        toast.error(`허들에 들어가지 못했습니다: ${(error as Error).message}`, { position: 'bottom-center' });
      }
    },
    [socket, joining, emit, teardown],
  );

  const leave = useCallback(() => {
    emit({ type: 'leave' });
    teardown();
  }, [emit, teardown]);

  // 서버가 보내는 허들 소식
  useEffect(() => {
    if (!socket) return undefined;
    const onList = (list: HuddleInfo[]) => setHuddles(Object.fromEntries(list.map((h) => [h.channelId, h])));
    const onUpdate = (info: HuddleInfo) => {
      setHuddles((prev) => {
        const next = { ...prev };
        if (info.members.length) next[info.channelId] = info;
        else delete next[info.channelId];
        return next;
      });
      if (info.channelId === currentRef.current) syncPeers(info);
    };
    const onJoined = (info: HuddleInfo) => {
      currentRef.current = info.channelId;
      setCurrent(info.channelId);
      setJoining(false);
      if (joinTimerRef.current) window.clearTimeout(joinTimerRef.current);
      onUpdate(info);
      // 마이크가 없으면 음소거로 보이게
      if (!micRef.current) {
        mutedRef.current = true;
        setMuted(true);
        sendState();
      }
    };
    const onEnded = ({ reason }: { reason: 'elsewhere' | 'removed' }) => {
      teardown();
      toast.info(
        reason === 'elsewhere'
          ? '다른 탭(기기)에서 허들에 들어가 여기서는 나왔습니다.'
          : '채널에서 나가 허들이 끝났습니다.',
        { position: 'bottom-center' },
      );
    };
    const onError = ({ reason }: { reason: string }) => {
      teardown();
      toast.error(reason === 'full' ? '허들이 가득 찼습니다 (최대 6명).' : '허들에 들어가지 못했습니다.', {
        position: 'bottom-center',
      });
    };
    const onSignal = async ({ from, data }: { channelId: number; from: number; data: Signal }) => {
      const peer = peersRef.current.get(from);
      if (!peer || !data) return;
      const { pc } = peer;
      try {
        if (data.description) {
          const collision = data.description.type === 'offer' && (peer.makingOffer || pc.signalingState !== 'stable');
          peer.ignoreOffer = !peer.polite && collision;
          if (peer.ignoreOffer) return;
          await pc.setRemoteDescription(data.description);
          if (data.description.type === 'offer') {
            await pc.setLocalDescription();
            sendSignal(from, { description: pc.localDescription?.toJSON() });
          }
        } else if (data.candidate) {
          try {
            await pc.addIceCandidate(data.candidate);
          } catch (error) {
            if (!peer.ignoreOffer) throw error;
          }
        }
      } catch (error) {
        console.error(error);
      }
    };
    socket.on('huddleList', onList);
    socket.on('huddleUpdate', onUpdate);
    socket.on('huddleJoined', onJoined);
    socket.on('huddleEnded', onEnded);
    socket.on('huddleError', onError);
    socket.on('huddleSignal', onSignal);
    return () => {
      socket.off('huddleList', onList);
      socket.off('huddleUpdate', onUpdate);
      socket.off('huddleJoined', onJoined);
      socket.off('huddleEnded', onEnded);
      socket.off('huddleError', onError);
      socket.off('huddleSignal', onSignal);
    };
  }, [socket, syncPeers, sendState, sendSignal, teardown]);

  // 소켓이 다시 연결되면 서버는 나를 허들에서 뺐으므로 다시 들어간다
  useEffect(() => {
    if (!socket) return undefined;
    const onReconnect = () => {
      if (currentRef.current !== null) emit({ type: 'join', channelId: currentRef.current });
    };
    socket.io.on('reconnect', onReconnect);
    return () => {
      socket.io.off('reconnect', onReconnect);
    };
  }, [socket, emit]);

  // 화면을 닫거나 다른 워크스페이스로 가면 나온다
  useEffect(() => {
    const onUnload = () => {
      if (currentRef.current !== null) emit({ type: 'leave' });
    };
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.removeEventListener('beforeunload', onUnload);
      if (currentRef.current !== null) {
        emit({ type: 'leave' });
        teardown();
      }
    };
  }, [emit, teardown]);

  // 말하는 사람 표시: 소리 크기를 잠깐씩 재서 일정 이상이면 '말하는 중'
  // 영상이 바뀔 때는 다시 만들지 않도록 음성 스트림만으로 키를 만든다
  const audioKey = Object.entries(remote)
    .map(([id, m]) => `${id}:${m.audio?.id || ''}`)
    .join();
  const audioStreams = useMemo(
    () => Object.entries(remote).map(([id, media]) => ({ userId: Number(id), stream: media.audio })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [audioKey],
  );

  useEffect(() => {
    if (current === null) return undefined;
    const AudioCtx =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return undefined;
    const ctx = new AudioCtx();
    const sources: { userId: number; analyser: AnalyserNode }[] = [];
    const add = (userId: number, stream: MediaStream | null) => {
      if (!stream?.getAudioTracks().length) return;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(analyser);
      sources.push({ userId, analyser });
    };
    if (me) add(me.id, micRef.current);
    audioStreams.forEach(({ userId, stream }) => add(userId, stream));
    const buffer = new Float32Array(512);
    const timer = window.setInterval(() => {
      const now = new Set<number>();
      sources.forEach(({ userId, analyser }) => {
        if (userId === me?.id && mutedRef.current) return;
        analyser.getFloatTimeDomainData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i += 1) sum += buffer[i] * buffer[i];
        if (Math.sqrt(sum / buffer.length) > SPEAKING_LEVEL) now.add(userId);
      });
      setSpeaking((prev) => (prev.size === now.size && Array.from(now).every((id) => prev.has(id)) ? prev : now));
    }, 200);
    return () => {
      window.clearInterval(timer);
      ctx.close().catch(() => undefined);
    };
  }, [current, audioStreams, me, noMic]);

  const toggleMute = () => {
    const track = micRef.current?.getAudioTracks()[0];
    if (!track) return;
    const next = !mutedRef.current;
    track.enabled = !next;
    mutedRef.current = next;
    setMuted(next);
    sendState();
  };

  const addVideo = (kind: 'camera' | 'screen', stream: MediaStream) => {
    const [track] = stream.getVideoTracks();
    peersRef.current.forEach((peer) => {
      peer.senders[kind] = peer.pc.addTrack(track, stream);
    });
  };
  const removeVideo = (kind: 'camera' | 'screen') => {
    peersRef.current.forEach((peer) => {
      const sender = peer.senders[kind];
      if (sender) {
        try {
          peer.pc.removeTrack(sender);
        } catch {
          // 이미 닫힌 연결
        }
        delete peer.senders[kind];
      }
    });
  };

  const toggleCamera = async () => {
    if (cameraRef.current) {
      removeVideo('camera');
      cameraRef.current.getTracks().forEach((t) => t.stop());
      cameraRef.current = null;
      setCamera(null);
      sendState();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 360 } },
        audio: false,
      });
      cameraRef.current = stream;
      setCamera(stream);
      addVideo('camera', stream);
      sendState();
    } catch {
      toast.error('카메라를 쓸 수 없습니다.', { position: 'bottom-center' });
    }
  };

  const stopScreen = useCallback(() => {
    if (!screenRef.current) return;
    removeVideo('screen');
    screenRef.current.getTracks().forEach((t) => t.stop());
    screenRef.current = null;
    setScreen(null);
    sendState();
  }, [sendState]);

  const toggleScreen = async () => {
    if (screenRef.current) {
      stopScreen();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      screenRef.current = stream;
      setScreen(stream);
      addVideo('screen', stream);
      // 브라우저의 '공유 중지' 버튼으로 끝냈을 때
      stream.getVideoTracks()[0].onended = stopScreen;
      sendState();
      setExpanded(true);
    } catch {
      // 사용자가 공유를 취소함
    }
  };

  const value = useMemo(
    () => ({ huddles, current, join, leave, expand: () => setExpanded(true) }),
    [huddles, current, join, leave],
  );
  const info = current !== null ? huddles[current] : undefined;
  const channel = channels?.find((c) => c.id === current);

  return (
    <HuddleContext.Provider value={value}>
      {children}
      {me && current !== null && info && (
        <HuddleView
          channelName={channel?.name || ''}
          info={info}
          me={me}
          members={members || []}
          expanded={expanded}
          onExpand={setExpanded}
          muted={muted}
          noMic={noMic}
          camera={camera}
          screen={screen}
          remote={remote}
          connected={connected}
          speaking={speaking}
          onToggleMute={toggleMute}
          onToggleCamera={toggleCamera}
          onToggleScreen={toggleScreen}
          onLeave={leave}
        />
      )}
    </HuddleContext.Provider>
  );
};

export default HuddleProvider;
