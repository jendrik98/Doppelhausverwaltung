const { test, expect } = require('@playwright/test');
const { openApp, top, section } = require('./helpers');

test('verhindert ungültige 0-Euro-Buchungen', async ({ page }) => {
  await openApp(page);
  await top(page,'Finanzen'); await section(page,'payments');
  await page.getByRole('button',{name:'Zahlungen & Kontoimport'}).click();
  await page.getByRole('button',{name:'Buchung hinzufügen'}).click();
  const modal=page.locator('#modal');
  await modal.locator('input[name="label"]').fill('Ungültige Testbuchung');
  await modal.locator('input[name="amount"]').fill('0');
  page.once('dialog',d=>d.accept());
  await modal.getByRole('button',{name:'Speichern',exact:true}).click();
  await expect(modal).toBeVisible();
});

test('zeigt Mietkonto und Versorgungsverantwortung', async ({ page }) => {
  await openApp(page);
  await top(page,'Vermietung');
  await expect(page.locator('#rentLedger')).toBeVisible();
  await expect(page.locator('#utilityResponsibility')).toContainText('Kaltwasser / Kanal');
  await expect(page.locator('#utilityResponsibility')).toContainText('eigener Mietervertrag');
});
