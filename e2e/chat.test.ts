import { expect, test } from '@playwright/test';
import { chatBox, messageRow, newUser, openAs, sendMessage } from './helpers';

test('두 사용자 실시간 채팅: 전송, 입력 중, 수정, 리액션, 스레드, 삭제', async ({
  browser,
}) => {
  const alice = newUser('alice');
  const bob = newUser('bob');
  const a = await openAs(browser, alice);
  const b = await openAs(browser, bob);
  const text = `안녕하세요 ${Date.now()}`;

  // 전송 → 상대에게 실시간 표시
  await sendMessage(a, text);
  await expect(messageRow(a, text)).toBeVisible();
  await expect(messageRow(b, text)).toBeVisible();

  // 입력 중 표시
  await chatBox(b).click();
  await chatBox(b).pressSequentially('입력 중', { delay: 30 });
  await expect(a.getByText(`${bob.nickname}님이 입력 중...`)).toBeVisible();
  await chatBox(b).fill('');

  // 수정 (Enter 저장) → 상대 화면에 (수정됨)
  await messageRow(a, text).hover();
  await messageRow(a, text).getByRole('button', { name: '수정' }).click();
  const edit = a.getByRole('textbox', { name: '메시지 수정' });
  await edit.fill(`${text} (고침)`);
  await edit.press('Enter');
  await expect(messageRow(b, `${text} (고침)`)).toContainText('(수정됨)');

  // 리액션
  const edited = `${text} (고침)`;
  await messageRow(b, edited).hover();
  await messageRow(b, edited)
    .getByRole('button', { name: '리액션 추가' })
    .click();
  await b.getByRole('button', { name: '👍 리액션' }).click();
  await expect(
    messageRow(a, edited).getByRole('button', { name: /👍 1/ }),
  ).toBeVisible();

  // 스레드 답글 → 본문에 답글 수
  await messageRow(b, edited).hover();
  await messageRow(b, edited)
    .getByRole('button', { name: '스레드로 답글' })
    .click();
  const reply = b.locator('#thread-reply');
  await reply.click();
  await reply.fill('스레드 답글');
  await reply.press('Enter');
  await expect(
    b.getByRole('complementary', { name: '스레드' }).getByText('스레드 답글'),
  ).toBeVisible();
  await expect(
    messageRow(a, edited).getByRole('button', { name: '답글 1개' }),
  ).toBeVisible();

  // 삭제 (확인 단계) → 상대 화면에서도 사라짐
  await messageRow(a, edited).hover();
  await messageRow(a, edited).getByRole('button', { name: '삭제' }).click();
  // 확인 상자 안의 '삭제' 버튼
  await messageRow(a, edited)
    .locator('div')
    .filter({ hasText: '이 메시지를 삭제할까요?' })
    .last()
    .getByRole('button', { name: '삭제', exact: true })
    .click();
  await expect(messageRow(b, edited)).toHaveCount(0);
});

test('DM: 상대 온라인 표시, 전송, 사이드바 안 읽음 배지', async ({
  browser,
}) => {
  const alice = newUser('dma');
  const bob = newUser('dmb');
  const b = await openAs(browser, bob);
  const a = await openAs(browser, alice, '/workspace/shlack/channel/일반');
  await a.goto(`/workspace/shlack/dm/${bob.id}`);
  await expect(a.getByText('● 온라인')).toBeVisible();
  await expect(
    a.getByText(`${bob.nickname}님과 나눈 다이렉트 메시지의 시작입니다`, {
      exact: false,
    }),
  ).toBeVisible();

  await sendMessage(a, 'DM 보내요');
  const dmLink = b
    .getByTestId('sidebar')
    .locator('a')
    .filter({ hasText: alice.nickname });
  await expect(dmLink.locator('.count')).toHaveText('1');
  await dmLink.click();
  await expect(messageRow(b, 'DM 보내요')).toBeVisible();
  await expect(dmLink.locator('.count')).toHaveCount(0);
});
