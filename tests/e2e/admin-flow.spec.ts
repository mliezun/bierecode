import { expect, test } from '@playwright/test';

const adminEmail = process.env.TEST_ADMIN_EMAIL;
const adminPassword = process.env.TEST_ADMIN_PASSWORD;

if (!adminEmail || !adminPassword) {
  throw new Error('TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD must be defined.');
}

test('admin can manage updates end-to-end', async ({ page, request }) => {
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Admin Sign In' })).toBeVisible();

  await page.getByLabel('Email').fill(adminEmail);
  await page.getByLabel('Password').fill(adminPassword);
  await page.getByRole('button', { name: 'Sign in' }).click();

  const createButton = page.getByRole('button', { name: 'Create update' });
  await expect(createButton).toBeVisible();
  await createButton.click();

  await expect(page.getByRole('heading', { name: 'Create update' })).toBeVisible();

  const title = `Playwright Update ${Date.now()}`;
  const editedTitle = `${title} (edited)`;
  await page.getByLabel('Title').fill(title);
  await page.getByLabel('Content').fill('Update created during Playwright E2E run.');
  await page.getByLabel('Language').selectOption('en');
  await page.getByLabel('Type').selectOption('post');

  const reloadAfterCreate = page.waitForResponse((res) => res.url().includes('/api/updates') && res.request().method() === 'GET');
  await page.getByRole('button', { name: 'Submit update' }).click();
  await reloadAfterCreate;

  const backToUpdates = page.getByRole('button', { name: 'Back to updates' });
  if (await backToUpdates.count()) {
    try {
      if (await backToUpdates.isVisible()) {
        await backToUpdates.click();
      }
    } catch (error) {
      // ignore when already on the list view
    }
  }

  await expect(createButton).toBeVisible();

  const updateCard = page.locator('article', { has: page.getByRole('heading', { name: title }) });
  await expect(updateCard).toBeVisible();

  await updateCard.getByRole('button', { name: 'Edit' }).click();
  await expect(page.getByRole('heading', { name: 'Edit update' })).toBeVisible();
  await page.getByLabel('Title').fill(editedTitle);
  await page.getByLabel('Content').fill('Update edited during Playwright E2E run.');

  const reloadAfterEdit = page.waitForResponse((res) => res.url().includes('/api/updates') && res.request().method() === 'GET');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await reloadAfterEdit;

  const backAfterEdit = page.getByRole('button', { name: 'Back to updates' });
  if (await backAfterEdit.count()) {
    try {
      if (await backAfterEdit.isVisible()) {
        await backAfterEdit.click();
      }
    } catch (error) {
      // ignore
    }
  }

  await expect(createButton).toBeVisible();

  const editedCard = page.locator('article', { has: page.getByRole('heading', { name: editedTitle }) });
  await expect(editedCard).toBeVisible();

  let response = await request.get('/api/updates');
  expect(response.ok()).toBeTruthy();
  let items = (await response.json()) as Array<{ title: string }>;
  expect(items.some((item) => item.title === editedTitle)).toBeTruthy();

  page.once('dialog', (dialog) => dialog.accept());
  await editedCard.getByRole('button', { name: 'Delete' }).click();

  response = await request.get('/api/updates');
  expect(response.ok()).toBeTruthy();
  items = (await response.json()) as Array<{ title: string }>;
  expect(items.some((item) => item.title === editedTitle)).toBeFalsy();
  await expect(page.locator('article', { has: page.getByRole('heading', { name: editedTitle }) })).toHaveCount(0);
});
