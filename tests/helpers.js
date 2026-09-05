const { expect } = require('@playwright/test');

function runtimeGuard(page) {
  const errors = [];
  const failed = [];
  page.on('pageerror', err => errors.push(String(err)));
  page.on('requestfailed', req => {
    const u = req.url();
    // External OCR/PDF CDNs are checked in their own integration test.
    if (!/cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com/.test(u)) failed.push(`${req.method()} ${u} :: ${req.failure()?.errorText || 'failed'}`);
  });
  return {
    assertClean() {
      expect(errors, `Browser-JavaScriptfehler:\n${errors.join('\n')}`).toEqual([]);
      expect(failed, `Fehlgeschlagene Kernrequests:\n${failed.join('\n')}`).toEqual([]);
    }
  };
}

async function openApp(page, hash = '#home') {
  await page.goto(`./${hash}`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#app')).not.toBeEmpty();
  await expect(page.getByText('Startfehler')).toHaveCount(0);
}

async function top(page, name) {
  await page.getByRole('button', { name, exact: true }).click();
}

async function section(page, value) {
  const picker = page.locator('#workspaceSelect');
  await expect(picker).toBeVisible();
  await picker.selectOption(value);
}

async function currentPeriodYear(page) {
  return await page.evaluate(() => {
    const d = new Date();
    return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  });
}

async function addUnit(page, data) {
  await page.getByRole('button', { name: 'Einheit hinzufügen' }).click();
  await page.getByLabel('Bezeichnung').fill(data.name);
  await page.getByLabel('Nutzung').selectOption(data.type);
  await page.getByLabel('Wohnfläche (m²)').fill(String(data.area));
  await page.getByLabel('Baujahr dieses Gebäudeteils').fill(String(data.year));
  await page.getByLabel('Gebäudeteil').fill(data.part);
  await page.getByLabel('Aktuelle Personenzahl').fill(String(data.persons));
  await page.getByLabel('Personenzahl gültig ab').fill(data.from);
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(page.getByRole('heading', { name: data.name })).toBeVisible();
}

module.exports = { runtimeGuard, openApp, top, section, currentPeriodYear, addUnit };
