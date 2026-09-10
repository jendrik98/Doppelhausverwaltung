const { test, expect } = require('@playwright/test');
const { openApp, top } = require('./helpers');

async function geometry(page) {
  return page.evaluate(() => {
    const clientWidth = document.documentElement.clientWidth;
    const offenders = [...document.querySelectorAll('body *')].map(el => {
      const r = el.getBoundingClientRect();
      return { tag: el.tagName.toLowerCase(), id: el.id || '', cls: String(el.className || '').slice(0,80), text: String(el.textContent || '').trim().replace(/\s+/g,' ').slice(0,80), parent: el.parentElement ? `${el.parentElement.tagName.toLowerCase()}#${el.parentElement.id || ''}.${String(el.parentElement.className || '').slice(0,60)}` : '', left: r.left, right: r.right, width: r.width };
    }).filter(x => x.width > 0 && (x.left < -1 || x.right > clientWidth + 1)).sort((a,b) => Math.max(b.right-clientWidth,-b.left) - Math.max(a.right-clientWidth,-a.left)).slice(0,12);
    return {
      innerWidth: window.innerWidth,
      clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      offenders
    };
  });
}

async function expectNoHorizontalOverflow(page, label) {
  const g = await geometry(page);
  const detail = `${label}: ${JSON.stringify(g.offenders)}`;
  expect(g.scrollWidth, `${detail} · document overflow`).toBeLessThanOrEqual(g.clientWidth + 1);
  expect(g.bodyScrollWidth, `${detail} · body overflow`).toBeLessThanOrEqual(g.clientWidth + 1);
}

async function expectHitAtCenter(locator, label) {
  await locator.scrollIntoViewIfNeeded();
  const hit = await locator.evaluate(el => {
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const target = document.elementFromPoint(x, y);
    return {
      ok: Boolean(target && (target === el || el.contains(target))),
      width: r.width,
      height: r.height,
      left: r.left,
      right: r.right,
      viewport: window.innerWidth,
      target: target ? `${target.tagName}#${target.id || ''}.${String(target.className || '')}` : null
    };
  });
  expect(hit.width, `${label}: Breite`).toBeGreaterThanOrEqual(44);
  expect(hit.height, `${label}: Höhe`).toBeGreaterThanOrEqual(44);
  expect(hit.left, `${label}: links im Viewport`).toBeGreaterThanOrEqual(-1);
  expect(hit.right, `${label}: rechts im Viewport`).toBeLessThanOrEqual(hit.viewport + 1);
  expect(hit.ok, `${label}: Mittelpunkt trifft ${hit.target}`).toBeTruthy();
}

test('F hält die komplette iPhone-Arbeitsfläche overflow-frei und direkt bedienbar', async ({ browser }) => {
  const context = await browser.newContext({
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:4173/',
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    colorScheme: 'light'
  });
  const page = await context.newPage();
  await openApp(page, '#home');

  await expect(page.getByRole('heading', { name: 'Dein Haus auf einen Blick' })).toBeVisible();
  await expect(page.locator('.quick-actions-bar')).toBeVisible();
  await expectNoHorizontalOverflow(page, 'Start');

  for (const name of ['Vermietung', 'Haus', 'Finanzen', 'Mehr']) {
    await top(page, name);
    await expectNoHorizontalOverflow(page, name);
  }

  await top(page, 'Haus');
  await expectHitAtCenter(page.getByRole('button', { name: 'Finanzen', exact: true }), 'Bottom-Navigation Finanzen');
  await page.getByRole('button', { name: 'Gebäude verwalten' }).click();
  await page.getByRole('button', { name: 'Gebäude hinzufügen' }).click();
  await expectNoHorizontalOverflow(page, 'Gebäudeformular');
  await expectHitAtCenter(page.getByRole('button', { name: 'Gebäude anlegen' }), 'Gebäude anlegen');
  await expectHitAtCenter(page.getByRole('button', { name: 'Schließen' }), 'Modal Schließen');

  await context.close();
});

test('F liefert auf Desktop eine eigenständige Arbeitsnavigation statt einer vergrößerten Mobile-Leiste', async ({ browser }) => {
  const context = await browser.newContext({
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:4173/',
    viewport: { width: 1440, height: 900 },
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin'
  });
  const page = await context.newPage();
  await openApp(page, '#home');

  const nav = page.locator('.main-tabs');
  await expect(nav).toBeVisible();
  const box = await nav.boundingBox();
  expect(box.width).toBeLessThanOrEqual(90);
  expect(box.height).toBeGreaterThan(250);
  expect(box.x).toBeLessThan(30);
  await expectNoHorizontalOverflow(page, 'Desktop Start');

  await top(page, 'Haus');
  await expect(page.locator('.workspace-sidebar')).toBeVisible();
  await expect(page.locator('.workspace-mobile-picker')).toBeHidden();
  await expectNoHorizontalOverflow(page, 'Desktop Haus');
  await page.screenshot({ path: 'test-results/design-system-f-desktop.png', fullPage: true });

  await context.close();
});
