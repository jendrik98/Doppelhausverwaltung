const { test, expect } = require('@playwright/test');
const { openApp, top, section } = require('./helpers');
const { fixtureFile } = require('./fixtures');

test('@external Dokument-OCR lädt im echten Browser und beendet sich kontrolliert', async ({ page }) => {
  test.setTimeout(150_000);
  await openApp(page);
  await top(page, 'Haus');
  await section(page, 'documents');
  await page.getByRole('button', { name: 'Dokument hinzufügen' }).click();
  await page.locator('#newDocLabel').fill('E2E OCR Test');
  await page.locator('#docPageFiles').setInputFiles(fixtureFile('ocr'));
  await expect(page.locator('#saveDocumentBtn')).toBeEnabled();
  await page.locator('#saveDocumentBtn').click();

  await expect(page.getByText('E2E OCR Test')).toBeVisible();
  await expect.poll(async () => {
    const body = await page.locator('body').innerText();
    if (/Analysefehler/.test(body)) return 'error';
    if (/analysiert/.test(body)) return 'done';
    return 'waiting';
  }, { timeout: 120_000 }).not.toBe('waiting');

  // Ein Analysefehler ist ein echter Testfehler: Produktions-CDN/OCR soll erreichbar sein.
  await expect(page.getByText('Analysefehler')).toHaveCount(0);
});
