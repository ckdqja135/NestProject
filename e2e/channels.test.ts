import { expect, test } from '@playwright/test';
import {
  mention,
  newUser,
  openAs,
  sendMessage,
  sidebarChannel,
} from './helpers';

test('비공개 채널 초대 → 사이드바 즉시 표시 → 멘션 알림과 읽음 처리', async ({
  browser,
}) => {
  const owner = newUser('owner');
  const guest = newUser('guest');
  const a = await openAs(browser, owner);
  const b = await openAs(browser, guest);
  const name = `비밀${Date.now() % 100000}`;

  // 비공개 채널 만들기 (모달)
  await a.getByTestId('workspace-name').click();
  await a.getByRole('menuitem', { name: '채널 만들기' }).click();
  await a.locator('#channel').fill(name);
  await a.getByText('🔒 비공개').click();
  await a.getByRole('button', { name: '만들기', exact: true }).click();
  await expect(a).toHaveURL(new RegExp(`/channel/${encodeURIComponent(name)}`));

  // 비멤버는 둘러보기에서도 보이지 않음
  await b.getByRole('button', { name: /채널 둘러보기/ }).click();
  await expect(b.getByRole('dialog', { name: '채널 둘러보기' })).toBeVisible();
  await expect(b.getByRole('dialog').getByText(name)).toHaveCount(0);
  await b.keyboard.press('Escape');

  // 멤버 검색으로 초대 → 상대 사이드바에 새로고침 없이 표시
  await a.getByRole('button', { name: '채널에 사람 초대' }).click();
  await a
    .getByRole('textbox', { name: '초대할 멤버 검색' })
    .fill(guest.nickname);
  await a
    .getByRole('dialog')
    .getByRole('button', { name: '초대', exact: true })
    .click();
  await expect(sidebarChannel(b, name)).toBeVisible();

  // 멘션 → 🔔 개수와 빨간 배지
  await a.keyboard.press('Escape');
  await sendMessage(a, `${mention(guest)} 확인 부탁해요`);
  await expect(
    b.getByRole('button', { name: '멘션 1개 안 읽음' }),
  ).toBeVisible();
  await expect(sidebarChannel(b, name).locator('.count')).toHaveText('1');

  // 채널에 들어가면 읽음 처리
  await sidebarChannel(b, name).click();
  await expect(
    b.getByRole('button', { name: '멘션', exact: true }),
  ).toBeVisible();
  await expect(sidebarChannel(b, name).locator('.count')).toHaveCount(0);
});
