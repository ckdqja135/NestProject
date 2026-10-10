import { expect, test } from '@playwright/test';
import { newUser, openAs } from './helpers';

test('위로 스크롤해 이전 메시지를 불러와도 새 메시지 때문에 중복되지 않는다', async ({
  browser,
}) => {
  const writer = newUser('writer');
  const reader = newUser('reader');
  const w = await openAs(browser, writer);
  // 새 채널에 메시지 45개
  const name = `스크롤${Date.now() % 100000}`;
  await w.request.post('/api/workspaces/shlack/channels', { data: { name } });
  const chats = `/api/workspaces/shlack/channels/${encodeURIComponent(
    name,
  )}/chats`;
  for (let i = 1; i <= 45; i++) {
    await w.request.post(chats, {
      data: { content: `메시지 ${String(i).padStart(2, '0')}` },
    });
  }
  const r = await openAs(browser, reader, '/workspace/shlack/channel/일반');
  await r.request.post(
    `/api/workspaces/shlack/channels/${encodeURIComponent(name)}/join`,
  );
  await r.goto(`/workspace/shlack/channel/${encodeURIComponent(name)}`);
  await expect(r.locator('section .chat-text p')).toHaveCount(20);

  // 첫 페이지를 받은 뒤 새 메시지 5개 도착
  for (let i = 1; i <= 5; i++) {
    await w.request.post(chats, { data: { content: `새 메시지 ${i}` } });
  }
  await expect(r.locator('section .chat-text p')).toHaveCount(25);

  // 맨 위까지 스크롤하며 이전 페이지를 모두 불러온다
  const scroller = r
    .locator('section')
    .first()
    .locator('xpath=ancestor::div[contains(@style,"overflow: scroll")][1]');
  for (let i = 0; i < 6; i++) {
    await scroller.evaluate((el) => el.scrollTo(0, 0));
    await r.waitForTimeout(500);
  }
  await expect(r.getByText(`#${name} 채널의 시작`)).toBeVisible();
  const texts = await r.locator('section .chat-text p').allTextContents();
  expect(texts.length).toBe(50);
  expect(new Set(texts).size).toBe(50);
  expect(texts[0]).toBe('메시지 01');
});
