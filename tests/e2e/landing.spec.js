import { test, expect } from '@playwright/test'

test('landing page loads', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveTitle(/Körset/)
  await expect(page.getByRole('heading', { name: /Körset/i })).toBeVisible()
})

test('retail cabinet button is visible', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('text=Кабинет')).toBeVisible()
})

test('/retail redirects to /auth when not logged in', async ({ page }) => {
  await page.goto('/retail', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/auth/)
})

test('store route loads app shell', async ({ page }) => {
  await page.goto('/s/store-one', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/s\/store-one/)
  await expect(page.locator('.app-frame')).toBeVisible()
})
