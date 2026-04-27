import { test, expect } from '@playwright/test'

test('landing page is consumer-first and keeps retail separate', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })

  await expect(page).toHaveTitle(/Körset|KГ¶rset/)
  await expect(
    page.getByRole('heading', { name: /Проверьте, подходит ли товар именно вам/i })
  ).toBeVisible()
  await expect(page.getByTestId('landing-consumer')).toBeVisible()
  await expect(page.getByTestId('landing-retail')).toBeVisible()

  await expect(
    page.getByTestId('landing-consumer').getByRole('link', { name: /Выбрать магазин/i })
  ).toHaveAttribute(
    'href',
    '/stores'
  )
  await expect(
    page.getByTestId('landing-pricing').getByRole('link', { name: /Подключить магазин/i })
  ).toHaveAttribute(
    'href',
    '/retail'
  )
})

test('landing exposes theme toggle and early access after retail entry', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })

  await expect(page.getByRole('button', { name: /Переключить тему/i })).toBeVisible()
  await expect(page.getByTestId('landing-pricing')).toContainText('15 000')
  await expect(page.getByTestId('landing-pricing')).toContainText('Premium')
  await expect(page.getByTestId('landing-pricing')).toContainText('Enterprise')
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
