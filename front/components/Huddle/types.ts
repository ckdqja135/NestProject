// 허들(채널 여러 명 통화) 공용 타입
export interface HuddleMember {
  userId: number;
  muted: boolean;
  video: boolean;
  sharing: boolean;
  cameraStream: string | null;
  screenStream: string | null;
  joinedAt: number;
}

// scope: ch-채널id · doc-문서id · ev-일정id
export interface HuddleInfo {
  scope: string;
  startedAt: number;
  members: HuddleMember[];
}

export interface RemoteMedia {
  audio: MediaStream | null;
  videos: Record<string, MediaStream>; // 스트림 id → 영상 (카메라·화면 공유)
}

// 휴대폰 브라우저 등은 화면 공유를 지원하지 않는다
export const canShareScreen = typeof navigator !== 'undefined' && 'getDisplayMedia' in (navigator.mediaDevices || {});
