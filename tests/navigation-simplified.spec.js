const { test, expect } = require('@playwright/test');
const { openApp, top, section } = require('./helpers');

async function optionValues(page) {
  return page.locator('#workspaceSelect option').evaluateAll(opts => opts.map(o => o.value));
}

async function expectOptions(page, expected) {
  await expect.poll(async () => optionValues(page)).toEqual(expected);
}

test('Fachbereiche sind auf die echten Arbeitswege reduziert', async ({ page }) => {
  await openApp(page, '#home');

  await expect(page.getByText('Nächste vier Monate')).toBeVisible();
  await expect(page.getByText('Aktuelle Anteile')).toBeVisible();

  await top(page, 'Vermietung');
  await expectOptions(page, ['overview','billing']);
  await expect(page.locator('#workspaceSelect option[value="lifecycle"]')).toHaveCount(0);
  await expect(page.locator('#workspaceSelect option[value="water"]')).toHaveCount(0);
  await expect(page.getByText('Mietvertrag / PDF')).toBeVisible();

  await section(page, 'billing');
  await expect(page.getByRole('button', { name: 'Kaltwasser & Zähler' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Jahresarchiv' })).toBeVisible();

  await top(page, 'Haus');
  await expectOptions(page, ['overview','costs','documents']);
  await expect(page.locator('#workspaceSelect option[value="infrastructure"]')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Objekt & Einheiten' })).toBeVisible();

  await section(page, 'costs');
  await expect(page.getByRole('heading', { name: 'Kostenpositionen' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Kostenquelle hinzufügen' })).toBeVisible();

  await top(page, 'Finanzen');
  await expectOptions(page, ['payments','planning']);
  await expect(page.locator('#workspaceSelect option[value="overview"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Buchung hinzufügen' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Zahlungen zuordnen/ })).toBeVisible();

  await section(page, 'planning');
  await expect(page.getByRole('heading', { name: 'Erinnerungen' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Kalender exportieren' })).toBeVisible();

  await top(page, 'Mehr');
  await expectOptions(page, ['protection','app']);
  await expect(page.locator('#workspaceSelect option[value="smart"]')).toHaveCount(0);
  await expect(page.locator('#workspaceSelect option[value="archive"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Datensicherung/ })).toBeVisible();

  await section(page, 'app');
  await expect(page.getByRole('button', { name: /Recht & Regeln/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Änderungsverlauf/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /App-Prüfung/ })).toBeVisible();
});
