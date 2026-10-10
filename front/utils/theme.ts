// 화면 테마: 시스템 설정 따르기 / 라이트 / 다크 (이 기기에 저장). html[data-theme] 로 색상 변수를 바꾼다.
export type ThemePref = 'system' | 'light' | 'dark';
export const THEME_KEY = 'shlack-theme';
export const THEME_LABELS: Record<ThemePref, string> = { system: '시스템 설정 따르기', light: '라이트', dark: '다크' };

const darkQuery = () =>
  typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

export const getThemePref = (): ThemePref => {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
};

const apply = (pref: ThemePref) => {
  const dark = pref === 'dark' || (pref === 'system' && !!darkQuery()?.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
};

export const setThemePref = (pref: ThemePref) => {
  try {
    if (pref === 'system') {
      localStorage.removeItem(THEME_KEY);
    } else {
      localStorage.setItem(THEME_KEY, pref);
    }
  } catch {
    // 저장소를 쓸 수 없으면 이번 화면에만 적용
  }
  apply(pref);
};

// 앱 시작 시 한 번: 저장된 테마를 적용하고, '시스템 설정 따르기'면 OS 설정이 바뀔 때 따라간다
export const initTheme = () => {
  apply(getThemePref());
  darkQuery()?.addEventListener?.('change', () => {
    if (getThemePref() === 'system') {
      apply('system');
    }
  });
};
