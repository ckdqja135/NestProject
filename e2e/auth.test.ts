import { expect, test } from '@playwright/test';
import { newUser } from './helpers';

test('회원가입 → 로그인(Enter) → 기본 채널 → 로그아웃', async ({ page }) => {
  const user = newUser('auth');

  await page.goto('/signup');
  await expect(page.getByText('Shlack')).toBeVisible();
  await page.locator('#email').fill(user.email);
  await page.locator('#nickname').fill(user.nickname);
  await page.locator('#password').fill(user.password);
  await page.locator('#password-check').fill(user.password);
  await page.locator('#password-check').press('Enter');
  await expect(page.getByText('회원가입되었습니다')).toBeVisible();

  await page.goto('/login');
  await page.locator('#email').fill(user.email);
  await page.locator('#password').fill(user.password);
  await page.locator('#password').press('Enter');
  await expect(page).toHaveURL(/\/workspace\/shlack\/channel\//);
  await expect(
    page
      .getByTestId('sidebar')
      .locator('a')
      .filter({ hasText: `${user.nickname} (나)` }),
  ).toBeVisible();

  // 프로필 메뉴 → 로그아웃
  await page.getByRole('button', { name: '내 프로필 메뉴' }).click();
  await page.getByRole('menuitem', { name: '로그아웃' }).click();
  await expect(page).toHaveURL(/\/login/);
});

test('틀린 비밀번호는 로그인 실패 안내', async ({ page }) => {
  await page.goto('/login');
  await page.locator('#email').fill('nobody@e2e.test');
  await page.locator('#password').fill('wrong');
  await page.locator('#password').press('Enter');
  await expect(
    page.getByText('이메일과 비밀번호 조합이 일치하지 않습니다.'),
  ).toBeVisible();
});
