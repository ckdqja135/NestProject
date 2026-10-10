import gravatar from 'gravatar';

// 아바타는 이메일 기반 Gravatar. 사용자가 고른 스타일(없으면 retro)을 쓴다. 이미지 파일을 서버에 올리지 않는다.
export const AVATAR_STYLES = [
  { value: 'retro', label: '레트로' },
  { value: 'identicon', label: '패턴' },
  { value: 'monsterid', label: '몬스터' },
  { value: 'wavatar', label: '얼굴' },
  { value: 'robohash', label: '로봇' },
  { value: 'mp', label: '기본' },
];

export const avatarUrl = (user: { email: string; avatarStyle?: string | null }, size: number, style?: string) =>
  gravatar.url(user.email, { s: `${size}px`, d: style || user.avatarStyle || 'retro', protocol: 'https' });
