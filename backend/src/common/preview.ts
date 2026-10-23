// 알림에 보여 줄 짧은 글: 멘션 표기는 @이름으로, GIF·파일·투표·전달은 설명으로
export const previewText = (content: string, max = 120) => {
  let text = content;
  if (text.startsWith('gif:')) text = '[GIF]';
  else if (text.startsWith('file:')) text = '[파일]';
  else if (text.startsWith('poll:')) text = '[투표]';
  else if (text.startsWith('fwd:')) text = '[전달한 메시지]';
  else if (text.startsWith('approval:')) {
    try {
      const value = JSON.parse(text.slice('approval:'.length));
      text = `[결재] ${value.n ? `${value.n} — ` : ''}${value.t}`;
    } catch {
      text = '[결재]';
    }
  }
  text = text.replace(/@\[(.+?)]\((\d+?|channel|here|g\d+)\)/g, '@$1');
  return text.length > max ? `${text.slice(0, max)}…` : text;
};
