const { test, expect } = require('@playwright/test');
const { runtimeGuard, openApp } = require('./helpers');

test('Live-Deployment, Version, Kernassets und Service Worker', async ({ page, request }) => {
  const guard = runtimeGuard(page);
  const core = await request.get('./app.js?v=1800');
  expect(core.ok()).toBeTruthy();
  const coreText = await core.text();
  expect(coreText).toContain('APP_VERSION="18.0.0"');
  expect(coreText).toContain('function v17RentLedgerCard');
  expect(coreText).toContain('function actualAdvanceInPeriod');
  const index = await request.get('./index.html');
  expect(index.ok()).toBeTruthy();
  const indexText = await index.text();
  expect(indexText).toContain('app.js?v=1800');
  expect(indexText).not.toContain('v17-upgrade.js');
  expect(indexText).not.toContain('v17-hotfix.js');
  expect(indexText).not.toContain('v17-water.js');
  for (const path of ['./style.css','./manifest.webmanifest','./legal-rules.json','./service-worker.js','./icon-192.png','./icon-512.png']) {
    const r=await request.get(path); expect(r.ok(),`${path} muss erreichbar sein`).toBeTruthy();
  }
  await openApp(page);
  await expect(page.getByRole('heading',{name:'Dein Haus auf einen Blick'})).toBeVisible();
  await expect(page.locator('#v17Badge')).toHaveText('V18');
  const sw=await page.evaluate(async()=>{if(!('serviceWorker'in navigator))return{supported:false};const reg=await Promise.race([navigator.serviceWorker.ready,new Promise((_,rej)=>setTimeout(()=>rej(new Error('SW timeout')),15000))]);return{supported:true,active:!!reg.active}});
  expect(sw.supported).toBeTruthy();expect(sw.active).toBeTruthy();guard.assertClean();
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
