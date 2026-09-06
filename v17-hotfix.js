/* Mietverwaltung V17.0.1 – Versorgungsprofil-Hotfix */
(() => {
"use strict";

const DB = "mietverwaltung-v6";
const STATE = "main";
const PROFILE = Object.freeze({
  coldWater: "landlord",
  heating: "tenant",
  hotWater: "tenant",
  electricity: "tenant",
  gas: "tenant"
});

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 2);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function correctProfile() {
  const db = await openDb();
  const tx = db.transaction("state", "readwrite");
  const store = tx.objectStore("state");
  const req = store.get(STATE);

  const state = await new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result?.data || null);
    req.onerror = () => reject(req.error);
  });

  if (!state) return;

  state.meta ||= {};
  state.meta.appVersion = "17.0.1";
  state.meta.v17 ||= {};
  state.meta.v17.utilityProfile = { ...PROFILE };
  state.meta.v17.profileSchema = 2;

  store.put({ id: STATE, data: state });

  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function correctVisibleCard() {
  const card = document.getElementById("v17Utilities");
  if (!card) return false;

  const rows = [...card.querySelectorAll(".fact-row")];
  const values = {
    "Kaltwasser / Kanal": "über Vermieter",
    "Heizung": "eigener Mietervertrag",
    "Warmwasser": "eigene Verantwortung",
    "Strom": "eigener Mietervertrag",
    "Gas": "eigener Mietervertrag"
  };

  for (const row of rows) {
    const label = row.querySelector("span")?.textContent?.trim();
    const value = row.querySelector("strong");
    if (value && values[label]) value.textContent = values[label];
  }
  return true;
}

function patchVersionText() {
  document.querySelectorAll("#workspaceBody p").forEach(p => {
    if (p.textContent.includes("App 17.0.0")) {
      p.innerHTML = p.innerHTML.replace("App 17.0.0", "App 17.0.1");
    }
  });
}

let tries = 0;
function refreshUi() {
  correctVisibleCard();
  patchVersionText();
  if (++tries < 40) setTimeout(refreshUi, 100);
}

correctProfile()
  .catch(console.warn)
  .finally(() => {
    document.getElementById("v17Utilities")?.remove();
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    refreshUi();
  });
})();
