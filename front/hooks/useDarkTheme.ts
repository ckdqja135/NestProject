import { useEffect, useState } from 'react';

const isDark = () => typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark';

// 지금 화면이 다크 테마인지 (테마를 바꾸면 따라간다)
export default function useDarkTheme() {
  const [dark, setDark] = useState(isDark);
  useEffect(() => {
    const observer = new MutationObserver(() => setDark(isDark()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);
  return dark;
}
