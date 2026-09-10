const { test, expect } = require('@playwright/test');
const { openApp, top, section } = require('./helpers');

async function optionValues(page) {
  return page.locator('#workspaceSelect option').evaluateAll(opts => opts.map(o => o.value));
}

async function expectOptions(page, expected) {
  await expect.poll(async () => optionValues(page)).toEqual(expected);
}

test('volle Startseite bleibt erhalten, Fachbereiche sind bewusst schmal', async ({ page }) => {
  await openApp(page, '#home');

  await expect(page.getByText('Nächste vier Monate')).toBeVisible();
  await expect(page.getByText('Aktuelle Anteile')).toBeVisible();
  await expect(page.getByText('Hausrate nach Kaltmiete')).toBeVisible();

  await top(page, 'Vermietung');
  await expectOptions(page, ['overview','lifecycle','water','billing']);
  await expect(page.locator('#workspaceSelect option[value="lease"]')).toHaveCount(0);
  await expect(page.getByText('Mietvertrag / PDF')).toBeVisible();
  await expect(page.getByRole('button', { name: /Mietvertrag anlegen|Vertragsdaten bearbeiten/ })).toBeVisible();

  await top(page, 'Haus');
  await expectOptions(page, ['overview','costs','infrastructure','documents']);
  await expect(page.locator('#workspaceSelect option[value="object"]')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Objekt & Einheiten' })).toBeVisible();

  await top(page, 'Finanzen');
  await expectOptions(page, ['overview','payments','planning']);
  await expect(page.locator('#workspaceSelect option[value="tasks"]')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Erinnerungen' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Kalender exportieren' })).toBeVisible();

  await top(page, 'Mehr');
  await expectOptions(page, ['smart','protection','app']);
  await expect(page.locator('#workspaceSelect option[value="legal"]')).toHaveCount(0);
  await section(page, 'app');
  await expect(page.getByRole('button', { name: /Recht & Regeln/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Änderungsverlauf/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /App-Prüfung/ })).toBeVisible();
});
