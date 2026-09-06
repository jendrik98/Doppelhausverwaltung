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

  // modal() setzt den Fokus absichtlich leicht verzögert auf das erste Feld.
  // Darauf synchronisieren, bevor weitere Felder ausgefüllt werden.
  const nameInput = modal.locator('input[name="name"]');
  await expect(nameInput).toBeFocused();

  await nameInput.fill(data.name);
  await modal.locator('select[name="type"]').selectOption(data.type);
  await modal.locator('input[name="area"]').fill(String(data.area));
  await modal.locator('input[name="constructionYear"]').fill(String(data.year));
  await modal.locator('input[name="buildingPart"]').fill(data.part);
  await modal.locator('input[name="persons"]').fill(String(data.persons));
  await modal.locator('input[name="occupancyFrom"]').fill(data.from);

  await expect(nameInput).toHaveValue(data.name);
  await expect(modal.locator('input[name="area"]')).toHaveValue(String(data.area));

  await modal.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(modal).toHaveClass(/hidden/);

  await expect(page.locator('#workspaceBody').getByText(data.name, { exact: true }).first()).toBeVisible();
}

module.exports = { runtimeGuard, openApp, top, section, currentPeriodYear, addUnit };
