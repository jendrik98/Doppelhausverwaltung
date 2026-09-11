import assert from "node:assert/strict";
import { build } from "esbuild";

const result = await build({
  entryPoints:["src/io/year-close-package.ts"],
  bundle:true, write:false, format:"esm", platform:"node", target:"node22", logLevel:"silent"
});
const mod=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);

function storedEntries(buffer){
  const entries=new Map();
  let offset=0;
  while(offset+30<=buffer.length && buffer.readUInt32LE(offset)===0x04034b50){
    assert.equal(buffer.readUInt16LE(offset+8),0);
    const size=buffer.readUInt32LE(offset+18);
    const nameLength=buffer.readUInt16LE(offset+26);
    const extraLength=buffer.readUInt16LE(offset+28);
    const nameStart=offset+30;
    const dataStart=nameStart+nameLength+extraLength;
    const name=buffer.subarray(nameStart,nameStart+nameLength).toString("utf8");
    entries.set(name,buffer.subarray(dataStart,dataStart+size));
    offset=dataStart+size;
  }
  return entries;
}

const archiveExport={
  schema:"doppelhaus-year-archive-v1",version:1,generatedAt:"2026-01-15T12:00:00.000Z",
  context:{buildingId:"building-a",buildingLabel:"Haus A"},
  archive:{
    year:2025,status:"ready",
    summary:{chains:1,completeChains:1,gaps:0,documents:2,payments:1,snapshots:1,unlinkedOutflows:0,unlinkedDocuments:1},
    documents:[
      {id:"doc-a",label:"Versicherung",type:"application/pdf",size:5},
      {id:"doc-pages",label:"Wasser Fotos",type:"image/jpeg",size:8}
    ],
    payments:[{id:"payment-a",date:"2025-02-01",direction:"outflow",amount:1200,label:"Versicherung",positionId:"position-a",sourceId:"source-a",leaseId:""}],
    billingSnapshots:[{id:"snap-a",periodYear:2025,buildingId:"building-a",leaseId:"lease-a",version:1,events:[]}],
    chains:[],unlinkedOutflows:[],unlinkedDocuments:[]
  }
};
const documents=[
  {id:"doc-a",label:"Versicherung",name:"Versicherung.pdf",type:"application/pdf",blob:new Blob(["PDF-A"],{type:"application/pdf"})},
  {id:"doc-pages",label:"Wasser Fotos",type:"image/jpeg",pages:[
    {id:"page-1",name:"Zaehler vorne.jpg",type:"image/jpeg",blob:new Blob(["FRONT"],{type:"image/jpeg"})},
    {id:"page-2",name:"Zaehler hinten.jpg",type:"image/jpeg",blob:new Blob(["BACK"],{type:"image/jpeg"})}
  ]},
  {id:"other-building",label:"Fremdes Haus",name:"fremd.pdf",type:"application/pdf",blob:new Blob(["FOREIGN"],{type:"application/pdf"})}
];

const coverage=mod.analyzeYearClosePackage(archiveExport,documents);
assert.equal(coverage.status,"complete");
assert.equal(coverage.documentRecords,2);
assert.equal(coverage.documentsWithBinary,2);
assert.equal(coverage.binaryFiles,3);
assert.deepEqual(coverage.missingBinaryDocuments,[]);

const pkg=await mod.createYearClosePackage(archiveExport,documents);
assert.equal(pkg.filename,"jahresabschluss-haus-a-2025-vollstaendig.zip");
assert.equal(pkg.blob.type,"application/zip");
assert.equal(pkg.manifest.schema,"doppelhaus-year-close-package-v1");
const entries=storedEntries(Buffer.from(await pkg.blob.arrayBuffer()));
for(const required of ["manifest.json","STATUS.txt","zahlungen.csv","abrechnungen.json"]) assert.ok(entries.has(required),`H3-Paketdatei fehlt: ${required}`);
const names=[...entries.keys()];
assert.equal(names.filter(name=>name.startsWith("dokumente/")).length,3);
assert.ok(names.some(name=>name.includes("versicherung")&&name.endsWith(".pdf")));
assert.ok(names.some(name=>name.includes("zaehler-vorne")&&name.endsWith(".jpg")));
assert.ok(!Buffer.concat([...entries.values()]).toString("utf8").includes("FOREIGN"));
assert.ok(entries.get("STATUS.txt").toString("utf8").includes("VOLLSTÄNDIG"));
assert.ok(entries.get("zahlungen.csv").toString("utf8").includes("payment-a"));
assert.equal(JSON.parse(entries.get("manifest.json").toString("utf8")).context.buildingId,"building-a");

const reviewExport=structuredClone(archiveExport);
reviewExport.archive.status="review";
reviewExport.archive.documents.push({id:"doc-missing",label:"Fehlende Originaldatei",type:"application/pdf",size:123});
const reviewCoverage=mod.analyzeYearClosePackage(reviewExport,documents);
assert.equal(reviewCoverage.status,"review");
assert.equal(reviewCoverage.missingBinaryDocuments.length,1);
const review=await mod.createYearClosePackage(reviewExport,documents);
assert.equal(review.filename,"jahresabschluss-haus-a-2025-pruefen.zip");
const reviewEntries=storedEntries(Buffer.from(await review.blob.arrayBuffer()));
assert.ok(reviewEntries.get("STATUS.txt").toString("utf8").includes("PRÜFEN"));
assert.ok(reviewEntries.get("STATUS.txt").toString("utf8").includes("Fehlende Originaldatei"));

console.log("Architecture H3 Jahresabschluss-Paket bestanden: selektive Belegdateien, ZIP-Struktur, Prüfstatus und Gebäudeisolation.");
