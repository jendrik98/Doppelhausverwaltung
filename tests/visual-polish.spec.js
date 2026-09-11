const { test, expect } = require('@playwright/test');
const { openApp, top } = require('./helpers');

test('iPhone-Typografie, Umbrüche und Aktionsbuttons bleiben ruhig und lesbar', async ({ browser }) => {
  const context = await browser.newContext({
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:4173/',
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin'
  });
  const page = await context.newPage();
  await openApp(page, '#owner/planning');

  const ui = await page.evaluate(() => {
    const px = value => Number.parseFloat(value || '0');
    const main = [...document.querySelectorAll('.main-tabs button')].map(el => ({
      font: px(getComputedStyle(el).fontSize),
      height: el.getBoundingClientRect().height
    }));
    const work = [...document.querySelectorAll('.workspace-mobile-tabs button')].map(el => ({
      font: px(getComputedStyle(el).fontSize),
      height: el.getBoundingClientRect().height
    }));
    const actions = [...document.querySelectorAll('.overview-button-group button')].map(el => ({
      height: el.getBoundingClientRect().height,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      whiteSpace: getComputedStyle(el).whiteSpace
    }));
    const group = document.querySelector('.overview-button-group');
    const heading = document.querySelector('.workspace-head h2');
    return {
      main,
      work,
      actions,
      groupWrap: group ? getComputedStyle(group).flexWrap : '',
      headingWrap: heading ? getComputedStyle(heading).overflowWrap : ''
    };
  });

  expect(Math.min(...ui.main.map(x => x.font))).toBeGreaterThanOrEqual(11);
  expect(Math.min(...ui.main.map(x => x.height))).toBeGreaterThanOrEqual(44);
  expect(Math.min(...ui.work.map(x => x.font))).toBeGreaterThanOrEqual(14);
  expect(Math.min(...ui.work.map(x => x.height))).toBeGreaterThanOrEqual(44);
  expect(ui.groupWrap).toBe('wrap');
  expect(ui.headingWrap).not.toBe('anywhere');
  for (const action of ui.actions) {
    expect(action.height).toBeGreaterThanOrEqual(44);
    expect(action.scrollWidth).toBeLessThanOrEqual(action.clientWidth + 1);
    expect(action.scrollHeight).toBeLessThanOrEqual(action.clientHeight + 1);
    expect(action.whiteSpace).toBe('normal');
  }

  await top(page, 'Haus');
  const metrics = await page.locator('.overview-cards .metric-card').evaluateAll(cards =>
    cards.map(card => [...card.children].map(el => ({
      display: getComputedStyle(el).display,
      width: el.getBoundingClientRect().width,
      parent: card.getBoundingClientRect().width
    })))
  );
  for (const card of metrics) for (const child of card) {
    expect(child.display).toBe('block');
    expect(child.width).toBeLessThanOrEqual(child.parent + 1);
  }

  await page.screenshot({ path: 'test-results/visual-polish-iphone.png', fullPage: true });
  await context.close();
});
