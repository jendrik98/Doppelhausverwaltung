const { test, expect } = require('@playwright/test');
const { openApp, top, section } = require('./helpers');
const fs = require('fs');

test('verschlüsselte Vollsicherung kann in frischem Browser wiederhergestellt werden', async ({ browser }) => {
  const context = await browser.newContext({
    baseURL: process.env.E2E_BASE_URL || 'https://jendrik98.github.io/Doppelhausverwaltung/',
    viewport: { width: 390, height: 844 }, locale: 'de-DE', timezoneId: 'Europe/Berlin',
    isMobile: true, hasTouch: true, serviceWorkers: 'allow', acceptDownloads: true
  });
  const page = await context.newPage();
  await openApp(page);

  await top(page, 'Haus');
  await section(page, 'object');
  await page.getByRole('button', { name: 'Objektdaten bearbeiten' }).click();
  await page.getByLabel('Objektname').fill('Backup E2E Objekt');
  await page.getByLabel('Adresse').fill('Backupweg 1');
  await page.getByLabel('Gesamtwohnfläche m²').fill('200');
  await page.getByRole('button', { name: 'Objektdaten speichern' }).click();

  await top(page, 'Mehr');
  await section(page, 'protection');
  await page.getByRole('button', { name: 'Datensicherung' }).click();
  await page.locator('#backupPw').fill('E2E-Test-Backup-2026!');
  const dlPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Sicherung erstellen' }).click();
  const dl = await dlPromise;
  const backupPath = 'test-results/e2e-backup.json';
  await dl.saveAs(backupPath);
  const wrapper = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  expect(wrapper.schema).toBe('mietverwaltung-encrypted-v1');

  await context.close();

  const restored = await browser.newContext({
    baseURL: process.env.E2E_BASE_URL || 'https://jendrik98.github.io/Doppelhausverwaltung/',
    viewport: { width: 390, height: 844 }, locale: 'de-DE', timezoneId: 'Europe/Berlin',
    isMobile: true, hasTouch: true, serviceWorkers: 'allow', acceptDownloads: true
  });
  const page2 = await restored.newPage();
  await openApp(page2);
  await top(page2, 'Mehr');
  await section(page2, 'protection');
  await page2.getByRole('button', { name: 'Datensicherung' }).click();
  await page2.locator('#backupPw').fill('E2E-Test-Backup-2026!');
  await page2.locator('#fullImportFile').setInputFiles(backupPath);
  page2.on('dialog', d => d.accept());
  await page2.getByRole('button', { name: 'Wiederherstellen' }).click();
  await page2.waitForTimeout(1000);

  await top(page2, 'Haus');
  await section(page2, 'object');
  await page2.getByRole('button', { name: 'Objektdaten bearbeiten' }).click();
  await expect(page2.getByLabel('Objektname')).toHaveValue('Backup E2E Objekt');
  await restored.close();
});
