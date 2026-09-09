const { test, expect } = require('@playwright/test');
const { runtimeGuard, openApp } = require('./helpers');

test('Live-Deployment, Version, Kernassets und Service Worker', async ({ page, request }) => {
  const guard = runtimeGuard(page);
  const core = await request.get('./app.js?v=1801');
  expect(core.ok()).toBeTruthy();
  const coreText = await core.text();
  expect(coreText).toContain('APP_VERSION="18.0.0"');
  expect(coreText).toContain('function v17RentLedgerCard');
  expect(coreText).toContain('function actualAdvanceInPeriod');
  const index = await request.get('./index.html');
  expect(index.ok()).toBeTruthy();
  const indexText = await index.text();
  expect(indexText).toContain('app.js?v=1801');
  expect(indexText).toContain('style.css?v=1810p2');
  expect(indexText).toContain('manifest.webmanifest?v=1810p2');
  expect(indexText).not.toContain('<meta name="theme-color" content="#0f172a">');
  expect(indexText).not.toContain('v17-upgrade.js');
  expect(indexText).not.toContain('v17-hotfix.js');
  expect(indexText).not.toContain('v17-water.js');
  const manifestResponse=await request.get('./manifest.webmanifest?v=1810p2');
  expect(manifestResponse.ok()).toBeTruthy();
  const manifest=await manifestResponse.json();
  expect(manifest.theme_color).toBe('#6f7d37');
  expect(manifest.background_color).toBe('#f4f6ef');
  expect(manifest.shortcuts.map(x=>x.url)).toEqual(['./#rental/billing','./#more/smart']);
  const swResponse=await request.get('./service-worker.js');
  const swText=await swResponse.text();
  expect(swText).toContain('mietverwaltung-v18-prod-hardening-a-1');
  expect(swText).toContain('./style.css?v=1810p2');
  for (const path of ['./style.css?v=1810p2','./manifest.webmanifest?v=1810p2','./legal-rules.json','./service-worker.js','./icon-192.png','./icon-512.png']) {
    const r=await request.get(path); expect(r.ok(),`${path} muss erreichbar sein`).toBeTruthy();
  }
  await openApp(page);
  await expect(page.getByRole('heading',{name:'Dein Haus auf einen Blick'})).toBeVisible();
  await expect(page.locator('#v17Badge')).toHaveText('V18');
  const sw=await page.evaluate(async()=>{if(!('serviceWorker'in navigator))return{supported:false};const reg=await Promise.race([navigator.serviceWorker.ready,new Promise((_,rej)=>setTimeout(()=>rej(new Error('SW timeout')),15000))]);return{supported:true,active:!!reg.active}});
  expect(sw.supported).toBeTruthy();expect(sw.active).toBeTruthy();
  await openApp(page,'#rental/billing');
  await expect(page).toHaveURL(/#rental\/billing$/);
  await expect(page.locator('#workspaceSelect')).toHaveValue('billing');
  await openApp(page,'#more/smart');
  await expect(page).toHaveURL(/#more\/smart$/);
  await expect(page.locator('#workspaceSelect')).toHaveValue('smart');
  guard.assertClean();
});

test('PWA startet nach Erstladen offline', async ({ page, context }) => {
  await openApp(page);
  await expect(page.locator('#v17Badge')).toHaveText('V18');
  await page.evaluate(async()=>navigator.serviceWorker?.ready);
  await page.reload({waitUntil:'domcontentloaded'});
  await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller),{timeout:15000}).toBeTruthy();
  await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});
  await expect(page.getByRole('heading',{name:'Dein Haus auf einen Blick'})).toBeVisible();
  await expect(page.locator('#v17Badge')).toHaveText('V18');
  await context.setOffline(false);
});
