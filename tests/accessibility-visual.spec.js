const { test, expect } = require('@playwright/test');
const { openApp, top, section } = require('./helpers');
const { fixtureFile } = require('./fixtures');

test('Touch-Ziele, sichtbarer Fokus und Dark Mode', async ({ page }) => {
  const contrast = async selector => page.locator(selector).first().evaluate(el => {
    const parse = value => { const m=String(value).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/); return m?[+m[1],+m[2],+m[3]]:null; };
    const lum = rgb => { const c=rgb.map(v=>v/255).map(v=>v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)); return .2126*c[0]+.7152*c[1]+.0722*c[2]; };
    const style=getComputedStyle(el),fg=parse(style.color); let node=el,bg=null;
    while(node&&!bg){ const raw=getComputedStyle(node).backgroundColor,c=parse(raw); if(c&&!/^rgba\([^)]*,\s*0(?:\.0+)?\)$/.test(raw))bg=c; node=node.parentElement; }
    if(!bg)bg=[255,255,255]; const a=lum(fg),b=lum(bg); return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
  });
  const assertTheme = async () => {
    await expect(page.locator('.card').first()).toBeVisible();
    expect(await contrast('body')).toBeGreaterThanOrEqual(4.5);
    expect(await contrast('.card')).toBeGreaterThanOrEqual(4.5);
    await page.getByRole('button', { name: 'Schnell hinzufügen' }).click();
    await page.locator('#quickOverlay').getByRole('button', { name: /^Zahlung\b/ }).click();
    await expect(page.locator('#modal input[name="label"]')).toBeVisible();
    expect(await contrast('#modal input[name="label"]')).toBeGreaterThanOrEqual(4.5);
    await page.getByRole('button', { name: 'Schließen' }).click();
  };

  await openApp(page);
  const bad = await page.locator('button:visible').evaluateAll(btns => btns.map(b => {
    const r = b.getBoundingClientRect(); return { label: b.getAttribute('aria-label') || b.innerText.trim(), w: r.width, h: r.height };
  }).filter(x => x.w < 44 || x.h < 44));
  expect(bad, `Touch-Ziele unter 44×44 px: ${JSON.stringify(bad)}`).toEqual([]);
  await page.keyboard.press('Tab');
  const focused = page.locator(':focus');
  const outline = await focused.evaluate(el => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe('none');
  await assertTheme();
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await assertTheme();
  await page.screenshot({ path: 'test-results/theme-dark-iphone.png', fullPage: true });
});

test('Zählerfoto-Zuschnitt ist auch ohne Dragging bedienbar', async ({ page }) => {
  await openApp(page, '#data/infrastructure');
  await page.getByRole('button', { name: 'Foto auswählen' }).click();
  await page.locator('#meterFileInput').setInputFiles(fixtureFile('meter'));
  await expect(page.locator('#meterCropStage')).toBeVisible();
  for (const name of ['Rahmen nach links', 'Rahmen nach oben', 'Rahmen nach unten', 'Rahmen nach rechts']) {
    await expect(page.getByRole('button', { name })).toBeVisible();
  }
  for (const name of ['Enger', 'Größer', 'Auto']) await expect(page.getByRole('button', { name })).toBeVisible();
  await page.getByRole('button', { name: 'Enger' }).click();
  await page.getByRole('button', { name: 'Rahmen nach rechts' }).click();
});

test('Desktop besitzt Sidebar statt mobiler Unterbereichsauswahl', async ({ browser }) => {
  const c = await browser.newContext({ baseURL: process.env.E2E_BASE_URL || 'https://jendrik98.github.io/Doppelhausverwaltung/', viewport: { width: 1440, height: 900 }, locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  const p = await c.newPage();
  await openApp(p);
  await top(p, 'Haus');
  await expect(p.locator('.workspace-sidebar')).toBeVisible();
  await expect(p.locator('.workspace-mobile-picker')).toBeHidden();
  await p.screenshot({ path: 'test-results/v16-desktop.png', fullPage: true });
  await c.close();
});
