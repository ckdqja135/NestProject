// 메시지에서 미리보기를 보여 줄 첫 링크 (코드 블록·인라인 코드 안의 주소는 빼고)
const URL_PATTERN = /https?:\/\/[^\s<>()[\]"']+[^\s<>()[\]"'.,:;!?]/i;

export const firstLink = (content: string): string | null => {
  const text = content.replace(/```[\s\S]*?```/g, ' ').replace(/`[^`\n]*`/g, ' ');
  const match = URL_PATTERN.exec(text);
  if (!match) return null;
  try {
    return new URL(match[0]).toString();
  } catch {
    return null;
  }
};
