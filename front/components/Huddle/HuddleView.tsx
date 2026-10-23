import { IUser } from '@typings/db';
import { avatarUrl } from '@utils/avatar';
import { Headphones, Maximize2, Mic, MicOff, Minimize2, MonitorUp, PhoneOff, Video, VideoOff } from 'lucide-react';
import React, { FC, useEffect, useRef, useState } from 'react';
import { canShareScreen, HuddleInfo, RemoteMedia } from './types';
import { HuddleBar, HuddleStage } from './styles';

const StreamVideo: FC<{ stream: MediaStream; mirror?: boolean; label: string }> = ({ stream, mirror, label }) => {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return <video ref={ref} autoPlay playsInline muted className={mirror ? 'mirror' : undefined} aria-label={label} />;
};

const StreamAudio: FC<{ stream: MediaStream }> = ({ stream }) => {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return <audio ref={ref} autoPlay />;
};

const useElapsed = (startedAt: number) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
};

interface Props {
  channelName: string;
  info: HuddleInfo;
  me: IUser;
  members: IUser[];
  expanded: boolean;
  onExpand: (expanded: boolean) => void;
  muted: boolean;
  noMic: boolean;
  camera: MediaStream | null;
  screen: MediaStream | null;
  remote: Record<number, RemoteMedia>;
  connected: Set<number>;
  speaking: Set<number>;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onToggleScreen: () => void;
  onLeave: () => void;
}

interface Tile {
  key: string;
  userId: number;
  name: string;
  user?: IUser;
  kind: 'person' | 'screen';
  stream: MediaStream | null;
  mine: boolean;
  muted: boolean;
  connecting: boolean;
}

// 허들 화면: 작게(사이드바 아래 막대) 또는 크게(참여자 타일)
const HuddleView: FC<Props> = ({
  channelName,
  info,
  me,
  members,
  expanded,
  onExpand,
  muted,
  noMic,
  camera,
  screen,
  remote,
  connected,
  speaking,
  onToggleMute,
  onToggleCamera,
  onToggleScreen,
  onLeave,
}) => {
  const elapsed = useElapsed(info.startedAt);
  const userOf = (id: number) => (id === me.id ? me : members.find((m) => m.id === id));

  const tiles: Tile[] = [];
  const screens: Tile[] = [];
  info.members.forEach((m) => {
    const mine = m.userId === me.id;
    const user = userOf(m.userId);
    const name = user?.nickname || '알 수 없음';
    const media = remote[m.userId];
    const cameraStream = mine ? camera : (m.cameraStream && media?.videos[m.cameraStream]) || null;
    const screenStream = mine ? screen : (m.screenStream && media?.videos[m.screenStream]) || null;
    const connecting = !mine && !connected.has(m.userId);
    tiles.push({
      key: `p${m.userId}`,
      userId: m.userId,
      name,
      user,
      kind: 'person',
      stream: m.video || mine ? cameraStream : null,
      mine,
      muted: mine ? muted : m.muted,
      connecting,
    });
    if (screenStream && (mine || m.sharing)) {
      screens.push({
        key: `s${m.userId}`,
        userId: m.userId,
        name,
        user,
        kind: 'screen',
        stream: screenStream,
        mine,
        muted: false,
        connecting,
      });
    }
  });

  const audios = Object.entries(remote)
    .filter(([, media]) => media.audio)
    .map(([id, media]) => <StreamAudio key={id} stream={media.audio!} />);

  const controls = (
    <div className="controls">
      <button
        type="button"
        className={muted ? 'off' : undefined}
        onClick={onToggleMute}
        disabled={noMic}
        aria-pressed={muted}
        title={noMic ? '마이크를 쓸 수 없습니다' : muted ? '음소거 해제' : '음소거'}
        aria-label={muted ? '음소거 해제' : '음소거'}
      >
        {muted ? <MicOff size={17} /> : <Mic size={17} />}
      </button>
      <button
        type="button"
        className={camera ? 'on' : undefined}
        onClick={onToggleCamera}
        aria-pressed={!!camera}
        title={camera ? '카메라 끄기' : '카메라 켜기'}
        aria-label={camera ? '카메라 끄기' : '카메라 켜기'}
      >
        {camera ? <Video size={17} /> : <VideoOff size={17} />}
      </button>
      {canShareScreen && (
        <button
          type="button"
          className={screen ? 'on' : undefined}
          onClick={onToggleScreen}
          aria-pressed={!!screen}
          title={screen ? '화면 공유 중지' : '화면 공유'}
          aria-label={screen ? '화면 공유 중지' : '화면 공유'}
        >
          <MonitorUp size={17} />
        </button>
      )}
      <button
        type="button"
        onClick={() => onExpand(!expanded)}
        title={expanded ? '작게 보기' : '크게 보기'}
        aria-label={expanded ? '작게 보기' : '크게 보기'}
      >
        {expanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
      </button>
      <button type="button" className="leave" onClick={onLeave} title="허들 나가기" aria-label="허들 나가기">
        <PhoneOff size={17} />
      </button>
    </div>
  );

  const renderTile = (tile: Tile) => (
    <div
      key={tile.key}
      className={`tile ${tile.kind}${speaking.has(tile.userId) && tile.kind === 'person' ? ' speaking' : ''}`}
      data-user={tile.userId}
      data-connected={tile.mine || !tile.connecting}
    >
      {tile.stream ? (
        <StreamVideo
          stream={tile.stream}
          mirror={tile.mine && tile.kind === 'person'}
          label={tile.kind === 'screen' ? `${tile.name}님의 화면` : `${tile.name}님의 카메라`}
        />
      ) : (
        tile.user && <img src={avatarUrl(tile.user, 160)} alt="" className="avatar" />
      )}
      <span className="label">
        {tile.kind === 'screen' && <MonitorUp size={12} />}
        {tile.kind === 'person' && tile.muted && <MicOff size={12} />}
        {tile.mine ? `${tile.name} (나)` : tile.name}
        {tile.kind === 'screen' ? ' 화면' : ''}
        {tile.connecting && <em> · 연결 중</em>}
      </span>
    </div>
  );

  if (expanded) {
    return (
      <HuddleStage role="dialog" aria-label={`#${channelName} 허들`}>
        {audios}
        <header>
          <Headphones size={16} />
          <strong>#{channelName} 허들</strong>
          <span className="time">{elapsed}</span>
          <span className="count">{info.members.length}명</span>
        </header>
        <div className={`stage${screens.length ? ' with-screen' : ''}`}>
          {screens.length > 0 && <div className="screens">{screens.map(renderTile)}</div>}
          <div className={`people n${Math.min(tiles.length, 6)}`}>{tiles.map(renderTile)}</div>
        </div>
        {controls}
      </HuddleStage>
    );
  }

  return (
    <HuddleBar role="region" aria-label={`#${channelName} 허들`}>
      {audios}
      <div className="top">
        <Headphones size={15} className="icon" />
        <button type="button" className="title" onClick={() => onExpand(true)} title="크게 보기">
          #{channelName}
        </button>
        <span className="time">{elapsed}</span>
      </div>
      <div className="people">
        {info.members.map((m) => {
          const user = userOf(m.userId);
          const isMuted = m.userId === me.id ? muted : m.muted;
          return (
            <span
              key={m.userId}
              className={`face${speaking.has(m.userId) ? ' speaking' : ''}`}
              title={`${user?.nickname || ''}${isMuted ? ' (음소거)' : ''}`}
              data-user={m.userId}
            >
              {user && <img src={avatarUrl(user, 56)} alt="" />}
              {isMuted && (
                <i>
                  <MicOff size={9} />
                </i>
              )}
            </span>
          );
        })}
        {(screen || info.members.some((m) => m.sharing)) && (
          <button type="button" className="sharing" onClick={() => onExpand(true)}>
            <MonitorUp size={12} /> 화면 공유 보기
          </button>
        )}
      </div>
      {controls}
    </HuddleBar>
  );
};

export default HuddleView;
