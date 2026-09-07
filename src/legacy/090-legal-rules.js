/* ===== legal-rules.js ===== */
const LAW_DATE="2026-09-05";

const LEGAL_SOURCES=[
  {name:"§ 556 BGB",url:"https://www.gesetze-im-internet.de/bgb/__556.html",purpose:"Betriebskosten, Abrechnung, Frist, Belegeinsicht"},
  {name:"§ 556a BGB",url:"https://www.gesetze-im-internet.de/bgb/__556a.html",purpose:"Abrechnungsmaßstab"},
  {name:"§ 556b BGB",url:"https://www.gesetze-im-internet.de/bgb/__556b.html",purpose:"Regelfälligkeit der Miete"},
  {name:"§ 560 BGB",url:"https://www.gesetze-im-internet.de/bgb/__560.html",purpose:"Anpassung von Vorauszahlungen"},
  {name:"BetrKV",url:"https://www.gesetze-im-internet.de/betrkv/",purpose:"Umlagefähige Betriebskosten"}
];

const CATEGORIES={
  propertyTax:{label:"Grundsteuer B",billable:true,basis:"§ 2 Nr. 1 BetrKV",defaultRule:"area"},
  rainwater:{label:"Niederschlagswasser",billable:true,basis:"§ 2 Nr. 3 BetrKV",defaultRule:"area"},
  street:{label:"Straßenreinigung / Winterdienst",billable:true,basis:"§ 2 Nr. 8 BetrKV",defaultRule:"area"},
  waste:{label:"Abfall",billable:true,basis:"§ 2 Nr. 8 BetrKV",defaultRule:"area"},
  insurance:{label:"Gebäudeversicherung",billable:true,basis:"§ 2 BetrKV",defaultRule:"area"},
  chimney:{label:"Schornsteinfeger",billable:true,basis:"§ 2 BetrKV",defaultRule:"area"},
  water:{label:"Kaltwasser / Kanal",billable:true,basis:"§ 2 Nr. 2/3 BetrKV",defaultRule:"consumption"},
  garden:{label:"Gartenpflege",billable:true,basis:"§ 2 BetrKV",defaultRule:"area"},
  cleaning:{label:"Gebäudereinigung",billable:true,basis:"§ 2 BetrKV",defaultRule:"area"},
  other:{label:"Sonstige Betriebskosten",billable:"check",basis:"§ 2 Nr. 17 BetrKV",defaultRule:"area"},
  admin:{label:"Verwaltungskosten",billable:false,basis:"§ 1 Abs. 2 Nr. 1 BetrKV",defaultRule:"owner"},
  repair:{label:"Instandhaltung / Reparatur",billable:false,basis:"§ 1 Abs. 2 Nr. 2 BetrKV",defaultRule:"owner"},
  internet:{label:"Internet Eigennutzung",billable:false,basis:"private Kosten",defaultRule:"owner"},
  broadcasting:{label:"Rundfunkbeitrag",billable:false,basis:"private Kosten",defaultRule:"owner"},
  financing:{label:"Hausfinanzierung",billable:false,basis:"keine Betriebskosten",defaultRule:"owner"}
};

let ACTIVE_LEGAL_PACK=null;
function category(id){
  return ACTIVE_LEGAL_PACK?.categories?.[id]||CATEGORIES[id]||{label:id,billable:"check",basis:"manuell prüfen",defaultRule:"area"}
}
async function loadLegalPack(){
  try{
    const r=await fetch("./legal-rules.json?ts="+Date.now(),{cache:"no-store"});
    if(!r.ok)throw new Error("HTTP "+r.status);
    const p=await r.json();
    if(p?.schema!=="mietverwaltung-legal-pack-v1"||!p.categories)throw new Error("Ungültiges Regelpaket");
    ACTIVE_LEGAL_PACK=p;return p
  }catch(e){
    console.warn("Regelpaket-Fallback aktiv",e);return null
  }
}

function legalDecision(source,{hasConsumption=false,assignment="house",agreement="auto"}={}){
  const c=category(source.category);
  if(c.billable===false) return {status:"blocked",billable:false,rule:"owner",reason:"Diese Kostenart ist nicht auf die Mieterin umlagefähig.",basis:c.basis};
  if(assignment==="owner") return {status:"ok",billable:false,rule:"owner",reason:"Die Kostenquelle ist ausschließlich der Eigennutzung zugeordnet.",basis:"Objektzuordnung"};
  if(assignment==="rental") return {status:"ok",billable:true,rule:"rental",reason:"Die Kostenquelle betrifft ausschließlich die Mietwohnung.",basis:"Direktzuordnung"};
  if(c.billable==="check") return {status:"check",billable:true,rule:agreement==="persons"?"persons":"area",reason:"Sonstige Betriebskosten müssen im konkreten Vertrag ausreichend erfasst sein.",basis:c.basis};
  if(hasConsumption || c.defaultRule==="consumption") return {status:"ok",billable:true,rule:"consumption",reason:"Der Verbrauch wird erfasst; daher wird verbrauchsbezogen verteilt.",basis:`${c.basis}; § 556a Abs. 1 BGB`};
  if(agreement==="persons") return {status:"ok",billable:true,rule:"persons",reason:"Personenschlüssel wurde als Vertragsvorgabe hinterlegt.",basis:"vertragliche Vereinbarung / § 556a BGB"};
  if(agreement==="area" || agreement==="auto") return {status:"ok",billable:true,rule:"area",reason:"Wohnfläche ist der hinterlegte bzw. gesetzliche Standardmaßstab.",basis:`${c.basis}; § 556a BGB`};
  return {status:"check",billable:true,rule:"manual",reason:"Individuelle Verteilung muss geprüft werden.",basis:c.basis};
}


