import { test, expect } from '@playwright/test'

test('landing page loads', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/Körset/)
  await expect(page.locator('text=Körset')).toBeVisible()
})

test('retail cabinet button is visible', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('text=Кабинет')).toBeVisible()
})

test('/retail redirects to /auth when not logged in', async ({ page }) => {
  await page.goto('/retail')
  await expect(page).toHaveURL(/\/auth/)
})

test('store public page loads', async ({ page }) => {
  await page.goto('/s/store-one')
  await expect(page.locator('text=Магазин 1')).toBeVisible({ timeout: 8000 })
})
