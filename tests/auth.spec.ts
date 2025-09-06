import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  const newUser = {
    name: 'Test User',
    // Use a unique email for each test run to avoid conflicts
    email: `testuser_${Date.now()}@example.com`,
    password: 'password123',
  };

  test('allows a user to sign up, log out, and log back in', async ({ page }) => {
    // --- 1. Sign Up ---
    await page.goto('/signup');

    await expect(page.getByRole('heading', { name: 'Registrieren' })).toBeVisible();

    await page.getByLabel('Name').fill(newUser.name);
    await page.getByLabel('Email').fill(newUser.email);
    await page.getByLabel('Passwort').fill(newUser.password);
    await page.getByRole('main').getByRole('button', { name: 'Registrieren' }).click();

    // After signup, user is redirected to login page with a success message
    // The redirect might take a moment, so we wait for the URL to change.
    await page.waitForURL('**/login**');
    await expect(page).toHaveURL(/.*login/);

    // The success message is a query param, let's check for it.
    const url = new URL(page.url());
    expect(url.searchParams.get('message')).toContain('Signup successful');

    // --- 2. Log In after Sign Up ---
    await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();

    await page.getByLabel('Email').fill(newUser.email);
    await page.getByLabel('Passwort').fill(newUser.password);
    await page.getByRole('button', { name: 'Login' }).click();

    // Should be redirected to the dashboard
    await page.waitForURL('**/dashboard**');
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.getByRole('heading', { name: `Willkommen, ${newUser.name}!` })).toBeVisible();

    // --- 3. Log Out ---
    // The logout button is in the header, which should be on the dashboard page
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
    await page.getByRole('button', { name: 'Logout' }).click();

    // Should be redirected to the landing page, where login is visible again
    await page.waitForURL('**/');
    await expect(page.getByRole('link', { name: 'Login' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Logout' })).not.toBeVisible();

    // --- 4. Log In Again ---
    await page.goto('/login');
    await page.getByLabel('Email').fill(newUser.email);
    await page.getByLabel('Passwort').fill(newUser.password);
    await page.getByRole('button', { name: 'Login' }).click();

    // Should be back on the dashboard
    await page.waitForURL('**/dashboard**');
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.getByRole('heading', { name: `Willkommen, ${newUser.name}!` })).toBeVisible();
  });
});
