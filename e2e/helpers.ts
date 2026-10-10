import { Browser, expect, Page } from '@playwright/test';

export interface TestUser {
  email: string;
  nickname: string;
  password: string;
  id?: number;
}

let seq = 0;
// 테스트마다 겹치지 않는 사용자
export const newUser = (name: string): TestUser => {
  seq += 1;
  const tag = `${Date.now().toString(36)}${seq}`;
  return {
    email: `${name}-${tag}@e2e.test`,
    nickname: `${name}${seq}`,
    password: 'test1234',
  };
};

// API 로 가입 + 로그인한 새 브라우저 컨텍스트(탭) 를 연다
export async function openAs(
  browser: Browser,
  user: TestUser,
  path = '/workspace/shlack/channel/일반',
) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.request.post('/api/users', { data: user });
  const res = await page.request.post('/api/users/login', {
    data: { email: user.email, password: user.password },
  });
  expect(res.ok()).toBeTruthy();
  user.id = (await res.json()).id;
  await page.goto(path);
  return page;
}

export const chatBox = (page: Page) => page.locator('#editor-chat');

export async function sendMessage(page: Page, text: string) {
  const box = chatBox(page);
  await box.click();
  await box.fill(text);
  await box.press('Enter');
}

// 채팅 목록에서 특정 내용을 가진 메시지 행
export const messageRow = (page: Page, text: string) =>
  page.locator('section .chat-text').filter({ hasText: text }).locator('..');

export const sidebarChannel = (page: Page, name: string) =>
  page.getByTestId('sidebar').locator('a').filter({ hasText: name });

// 멘션 마크업(react-mentions 형식)
export const mention = (user: TestUser) => `@[${user.nickname}](${user.id})`;
