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

  const modal = page.locator('#modal');
  await expect(modal).toBeVisible();

  await modal.getByLabel('Bezeichnung').fill(data.name);
  await modal.getByLabel('Nutzung').selectOption(data.type);
  await modal.getByLabel('Wohnfläche (m²)').fill(String(data.area));
  await modal.getByLabel('Baujahr dieses Gebäudeteils').fill(String(data.year));
  await modal.getByLabel('Gebäudeteil', { exact: true }).fill(data.part);
  await modal.getByLabel('Aktuelle Personenzahl').fill(String(data.persons));
  await modal.getByLabel('Personenzahl gültig ab').fill(data.from);

  await expect(modal.getByLabel('Bezeichnung')).toHaveValue(data.name);
  await expect(modal.getByLabel('Wohnfläche (m²)')).toHaveValue(String(data.area));

  await modal.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(modal).toHaveClass(/hidden/);

  await expect(page.locator('#workspaceBody').getByText(data.name, { exact: true }).first()).toBeVisible();
}

module.exports = { runtimeGuard, openApp, top, section, currentPeriodYear, addUnit };
