const { test, expect } = require('@playwright/test');
const { runtimeGuard, openApp } = require('./helpers');

test('Live-Deployment, Version, Kernassets und Service Worker', async ({ page, request }) => {
  const guard = runtimeGuard(page);
  const core = await request.get('./app.js?v=1602');
  expect(core.ok()).toBeTruthy();
  expect(await core.text()).toContain('APP_VERSION="16.0.2"');
  const v17 = await request.get('./v17-upgrade.js?v=1700');
  expect(v17.ok()).toBeTruthy();
  expect(await v17.text()).toContain('const V="17.0.0"');
  for (const path of ['./style.css','./manifest.webmanifest','./legal-rules.json','./service-worker.js','./icon-192.png','./icon-512.png']) {
    const r=await request.get(path); expect(r.ok(),`${path} muss erreichbar sein`).toBeTruthy();
  }
  await openApp(page);
  await expect(page.getByRole('heading',{name:'Dein Haus auf einen Blick'})).toBeVisible();
  await expect(page.locator('#v17Badge')).toHaveText('V17');
  const sw=await page.evaluate(async()=>{if(!('serviceWorker'in navigator))return{supported:false};const reg=await Promise.race([navigator.serviceWorker.ready,new Promise((_,rej)=>setTimeout(()=>rej(new Error('SW timeout')),15000))]);return{supported:true,active:!!reg.active}});
  expect(sw.supported).toBeTruthy();expect(sw.active).toBeTruthy();guard.assertClean();
});

test('PWA startet nach Erstladen offline', async ({ page, context }) => {
  await openApp(page);
  await expect(page.locator('#v17Badge')).toHaveText('V17');
  await page.evaluate(async()=>navigator.serviceWorker?.ready);
  await page.reload({waitUntil:'domcontentloaded'});
  await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller),{timeout:15000}).toBeTruthy();
  await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});
  await expect(page.getByRole('heading',{name:'Dein Haus auf einen Blick'})).toBeVisible();
  await expect(page.locator('#v17Badge')).toHaveText('V17');
  await context.setOffline(false);
});
