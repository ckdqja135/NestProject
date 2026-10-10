import { expect, test } from '@playwright/test';
import { newUser, openAs } from './helpers';

test('워크스페이스 만들기: 주소 자동 추천, 입력 검증, 생성 후 이동', async ({
  browser,
}) => {
  const user = newUser('maker');
  const page = await openAs(browser, user);
  const suffix = Date.now() % 100000;

  await page.getByRole('button', { name: '워크스페이스 만들기' }).click();
  await page.locator('#workspace').fill(`Design Team ${suffix}`);
  await expect(page.locator('#workspace-url')).toHaveValue(
    `design-team-${suffix}`,
  );

  await page.locator('#workspace-url').fill('한글 주소');
  await expect(
    page.getByText('영문, 숫자, 하이픈(-), 밑줄(_)만 사용할 수 있습니다.'),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '만들기', exact: true }),
  ).toBeDisabled();

  await page.locator('#workspace-url').fill(`dt-${suffix}`);
  await page.getByRole('button', { name: '만들기', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/workspace/dt-${suffix}/channel/`));
  await expect(
    page.getByRole('link', { name: `Design Team ${suffix} 워크스페이스` }),
  ).toBeVisible();
});

test('소유자가 멤버를 내보내면 상대는 알림과 함께 다른 워크스페이스로 이동', async ({
  browser,
}) => {
  const owner = newUser('boss');
  const member = newUser('crew');
  const a = await openAs(browser, owner);
  const b = await openAs(browser, member);
  const url = `team-${Date.now() % 100000}`;
  await a.request.post('/api/workspaces', {
    data: { workspace: `팀${url}`, url },
  });
  await a.request.post(`/api/workspaces/${url}/members`, {
    data: { email: member.email },
  });
  await b.goto(`/workspace/${url}/channel/일반`);
  await expect(b.getByTestId('workspace-name')).toHaveText(`팀${url}`);

  await a.goto(`/workspace/${url}/channel/일반`);
  await a.getByTestId('workspace-name').click();
  await a.getByRole('menuitem', { name: '멤버 보기 · 관리' }).click();
  const row = a
    .getByRole('dialog')
    .locator('div')
    .filter({ hasText: member.email })
    .last()
    .locator('..');
  await row.getByRole('button', { name: '내보내기' }).click();
  await row.getByRole('button', { name: '내보내기' }).last().click();
  await expect(
    a.getByText(`${member.nickname} 님을 내보냈습니다.`),
  ).toBeVisible();

  await expect(b.getByText('워크스페이스에서 내보내졌습니다.')).toBeVisible();
  await expect(b).toHaveURL(/\/workspace\/shlack\/channel\//);
});
