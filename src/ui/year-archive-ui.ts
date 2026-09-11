import { buildYearArchive, createYearArchiveExport } from "../domain/year-archive";

type AnyRecord = Record<string, any>;
type ArchiveOptions = {
  state: AnyRecord;
  loadDocuments: () => Promise<AnyRecord[]>;
  buildingId?: string;
  buildingLabel?: string;
  initialYear?: number;
  onNavigate?: (route: string, sub?: string) => void;
  isCurrent?: () => boolean;
};

const arr = (value: unknown): AnyRecord[] => Array.isArray(value) ? value as AnyRecord[] : [];
const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
}[char] || char));
const euro = (value: unknown): string => Number(value || 0).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
const date = (value: unknown): string => {
  const text=String(value || "").slice(0,10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return "–";
  return new Date(`${text}T00:00:00`).toLocaleDateString("de-DE");
};

function yearsFromState(state: AnyRecord): number[] {
  const years = new Set<number>();
  for (const position of arr(state?.costPositions)) {
    for (const raw of [position.serviceStart, position.serviceEnd]) {
      const year=Number(String(raw || "").slice(0,4));
      if (year >= 2000 && year <= 2200) years.add(year);
    }
  }
  for (const payment of arr(state?.payments)) {
    const year=Number(String(payment.date || "").slice(0,4));
    if (year >= 2000 && year <= 2200) years.add(year);
  }
  for (const snapshot of arr(state?.billingSnapshots)) {
    const year=Number(snapshot.periodYear);
    if (year >= 2000 && year <= 2200) years.add(year);
  }
  if (!years.size) years.add(new Date().getFullYear());
  return [...years].sort((a,b)=>b-a);
}

function missingLabel(kind: string): string {
  return kind === "document" ? "Dokument" : kind === "payment" ? "Zahlung" : kind === "billing" ? "Abrechnung" : kind;
}

function safeName(value: string): string {
  return value.normalize("NFKD").replace(/[^a-zA-Z0-9_-]+/g,"-").replace(/^-+|-+$/g,"").toLowerCase() || "gebaeude";
}

function saveJson(payload: AnyRecord, filename: string): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function evidencePill(ok: boolean, label: string): string {
  return `<span class="pill ${ok ? "good" : "warn"}">${ok ? "✓" : "!"} ${esc(label)}</span>`;
}

function chainHtml(chain: AnyRecord, onNavigate?: ArchiveOptions["onNavigate"]): string {
  const missing=arr(chain.missing).map(String);
  const documentOk=!!chain.document;
  const paymentOk=arr(chain.payments).length>0;
  const billingOk=arr(chain.billingSnapshots).length>0;
  const candidateCount=arr(chain.candidatePayments).length;
  const routeButtons = missing.map(kind => {
    const target = kind === "document" ? ["data","documents"] : kind === "payment" ? ["owner","payments"] : ["rental","billing"];
    return `<button class="secondary compact" data-archive-fix="${esc(kind)}" data-route="${target[0]}" data-sub="${target[1]}">${esc(missingLabel(kind))} ergänzen</button>`;
  }).join("");
  return `<article class="card archive-chain" data-archive-chain="${esc(chain.position?.id)}">
    <div class="card-head"><div><p class="eyebrow">KOSTENPOSITION</p><h3>${esc(chain.position?.label || "Kostenposition")}</h3><p class="muted">${date(chain.position?.serviceStart)} – ${date(chain.position?.serviceEnd)}</p></div><div><strong>${euro(chain.position?.amount)}</strong><br><span class="pill ${chain.status === "complete" ? "good" : "warn"}">${chain.status === "complete" ? "Vollständig" : `${missing.length} Lücke(n)`}</span></div></div>
    <div class="row" style="flex-wrap:wrap;gap:8px">${evidencePill(documentOk,"Dokument")}${evidencePill(paymentOk,"Zahlung")}${evidencePill(billingOk,"Abrechnung")}</div>
    ${chain.document ? `<div class="fact-row"><span>Beleg</span><strong>${esc(chain.document.label || chain.document.id)}</strong></div>` : ""}
    ${paymentOk ? `<div class="fact-row"><span>Direkte Zahlungen</span><strong>${arr(chain.payments).length} · ${euro(arr(chain.payments).reduce((sum,p)=>sum+Number(p.amount||0),0))}</strong></div>` : ""}
    ${billingOk ? `<div class="fact-row"><span>Abrechnungssnapshot</span><strong>${arr(chain.billingSnapshots).map(s=>`v${Number(s.version||1)}`).join(", ")}</strong></div>` : ""}
    ${candidateCount ? `<div class="info"><strong>${candidateCount} Zahlungskandidat(en)</strong><br><small>Gemeinsame Kostenquelle erkannt, aber keine direkte positionId-Verknüpfung. Die Lücke bleibt bewusst offen.</small></div>` : ""}
    ${missing.length ? `<div class="legal-warn"><strong>Nachweis noch unvollständig:</strong> ${missing.map(missingLabel).map(esc).join(", ")}<div class="row" style="margin-top:10px;flex-wrap:wrap;gap:8px">${routeButtons}</div></div>` : `<div class="legal-ok"><strong>Nachweiskette vollständig.</strong> Dokument, direkte Zahlung und Abrechnung sind explizit verknüpft.</div>`}
  </article>`;
}

function renderArchive(host: HTMLElement, options: ArchiveOptions, documents: AnyRecord[], selectedYear: number): void {
  const archive=buildYearArchive(options.state, documents, selectedYear);
  const years=yearsFromState(options.state);
  if (!years.includes(selectedYear)) years.unshift(selectedYear);
  const ready=archive.status === "ready";
  host.innerHTML=`<section data-year-archive-root>
    <div class="card"><div class="row between"><div><p class="eyebrow">ARCHITECTURE H2 · JAHRESABSCHLUSS</p><h3>Jahresarchiv ${selectedYear}</h3><p class="muted">${esc(options.buildingLabel || "Aktives Gebäude")} · Nachweise aus dem aktuellen, gebäudeisolierten Arbeitsbereich.</p></div><span class="pill ${ready ? "good" : "warn"}" data-archive-status>${ready ? "Abschlussbereit" : "Prüfen"}</span></div>
      <div class="row" style="margin-top:14px;flex-wrap:wrap;gap:10px"><label><span class="muted">Jahr</span><select id="yearArchiveYearSelect" aria-label="Archivjahr">${years.map(year=>`<option value="${year}" ${year===selectedYear?"selected":""}>${year}</option>`).join("")}</select></label><button id="yearArchiveExport" class="primary">Archiv-Manifest exportieren</button></div>
      <p class="muted">Der Export enthält JSON-sichere Metadaten und Referenzen, keine PDF-/Bild-Binärdaten. Ein Export im Prüfstatus dokumentiert offene Lücken, schließt sie aber nicht.</p>
    </div>
    <div class="grid cards">
      <article class="card metric-card"><span>Nachweisketten</span><strong>${archive.summary.chains}</strong><small>${archive.summary.completeChains} vollständig</small></article>
      <article class="card metric-card"><span>Offene Lücken</span><strong>${archive.summary.gaps}</strong><small>Dokument / Zahlung / Abrechnung</small></article>
      <article class="card metric-card"><span>Abrechnungssnapshots</span><strong>${archive.summary.snapshots}</strong><small>für ${selectedYear}</small></article>
      <article class="card metric-card"><span>Nicht zugeordnet</span><strong>${archive.summary.unlinkedDocuments + archive.summary.unlinkedOutflows}</strong><small>${archive.summary.unlinkedDocuments} Dokumente · ${archive.summary.unlinkedOutflows} Ausgaben</small></article>
    </div>
    <div class="card"><div class="card-head"><div><p class="eyebrow">NACHWEISKETTEN</p><h3>Dokument → Kosten → Zahlung → Abrechnung</h3></div></div>${archive.chains.length ? archive.chains.map((chain:AnyRecord)=>chainHtml(chain,options.onNavigate)).join("") : `<div class="empty-state"><strong>Keine bestätigten Kostenpositionen für ${selectedYear}</strong><p>Das Archiv bleibt im Prüfstatus, bis für dieses Jahr abrechnungsrelevante Daten vorliegen.</p></div>`}</div>
    ${(archive.unlinkedDocuments.length || archive.unlinkedOutflows.length) ? `<div class="grid two-up">
      <article class="card"><h3>Nicht zugeordnete Dokumente</h3>${archive.unlinkedDocuments.length ? archive.unlinkedDocuments.map((doc:AnyRecord)=>`<div class="item"><strong>${esc(doc.label||doc.id)}</strong><p>${date(doc.created)} · ${esc(doc.analysisStatus||"ohne Analysestatus")}</p></div>`).join("") : `<p class="muted">Keine.</p>`}</article>
      <article class="card"><h3>Nicht zugeordnete Ausgaben</h3>${archive.unlinkedOutflows.length ? archive.unlinkedOutflows.map((payment:AnyRecord)=>`<div class="item"><strong>${esc(payment.label||payment.id)}</strong><p>${date(payment.date)} · ${euro(payment.amount)}</p></div>`).join("") : `<p class="muted">Keine.</p>`}</article>
    </div>` : ""}
  </section>`;

  const select=host.querySelector<HTMLSelectElement>("#yearArchiveYearSelect");
  if (select) select.onchange=()=>renderArchive(host,options,documents,Number(select.value));
  host.querySelectorAll<HTMLElement>("[data-archive-fix]").forEach(button=>{
    button.onclick=()=>options.onNavigate?.(button.dataset.route||"home",button.dataset.sub||"");
  });
  const exportButton=host.querySelector<HTMLButtonElement>("#yearArchiveExport");
  if (exportButton) exportButton.onclick=()=>{
    const payload={
      ...createYearArchiveExport(options.state, documents, selectedYear),
      context:{buildingId:String(options.buildingId||""),buildingLabel:String(options.buildingLabel||"")}
    };
    saveJson(payload,`jahresarchiv-${safeName(String(options.buildingLabel||"gebaeude"))}-${selectedYear}.json`);
  };
}

export async function mountYearArchiveWorkspace(host: HTMLElement | null, options: ArchiveOptions): Promise<void> {
  if (!host) return;
  host.innerHTML=`<div class="card"><strong>Jahresarchiv wird geladen …</strong><p class="muted">Dokumente und Nachweisketten werden lokal zusammengeführt.</p></div>`;
  try {
    const documents=await options.loadDocuments();
    if (options.isCurrent && !options.isCurrent()) return;
    const years=yearsFromState(options.state);
    const selected=Number(options.initialYear)||years[0];
    renderArchive(host,options,documents,selected);
  } catch (error: any) {
    host.innerHTML=`<div class="legal-bad"><strong>Jahresarchiv konnte nicht geladen werden.</strong><br>${esc(error?.message||error)}</div>`;
  }
}
