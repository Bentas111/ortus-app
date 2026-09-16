// App Store Connect bez przeglądarki — wszystko przez oficjalne API i klucz .p8.
//   node asc.js                 → stan aplikacji, wersji i budów
//   node asc.js wydaj 1.0.4     → nowa wersja, podpięcie najnowszej budowy i wysyłka do recenzji
const fs = require("fs"), crypto = require("crypto");

const KEY_ID = "NHT77F5LX4", ISSUER = "839f329b-39aa-4ced-b171-7db7d67e1b7c";
const P8 = "C:\\Users\\48607\\Downloads\\AuthKey_NHT77F5LX4.p8";
const APP = "6809715926";
const API = "https://api.appstoreconnect.apple.com";

const b64u = (b) => Buffer.from(b).toString("base64url");
function token() {
  const k = crypto.createPrivateKey(fs.readFileSync(P8, "utf8"));
  const h = b64u(JSON.stringify({ alg: "ES256", kid: KEY_ID, typ: "JWT" }));
  const t = Math.floor(Date.now() / 1000);
  const b = b64u(JSON.stringify({ iss: ISSUER, iat: t, exp: t + 900, aud: "appstoreconnect-v1" }));
  return h + "." + b + "." + b64u(crypto.sign(null, Buffer.from(h + "." + b), { key: k, dsaEncoding: "ieee-p1363" }));
}
const H = () => ({ Authorization: "Bearer " + token(), "Content-Type": "application/json" });

async function api(sciezka, opcje) {
  const r = await fetch(API + sciezka, { headers: H(), ...opcje });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch (e) {}
  if (r.status >= 400) {
    const e = (j && j.errors || []).map(x => x.detail || x.title).join("; ");
    throw new Error(r.status + " " + (e || t.slice(0, 200)));
  }
  return j;
}

async function stan() {
  const w = await api("/v1/apps/" + APP + "/appStoreVersions?limit=5&fields[appStoreVersions]=versionString,appStoreState,createdDate&include=build&fields[builds]=version");
  const b = await api("/v1/builds?filter[app]=" + APP + "&limit=5&fields[builds]=version,processingState,uploadedDate");
  const z = await api("/v1/reviewSubmissions?filter[app]=" + APP + "&filter[state]=READY_FOR_REVIEW,WAITING_FOR_REVIEW,IN_REVIEW,UNRESOLVED_ISSUES&limit=3&fields[reviewSubmissions]=state");
  console.log("WERSJE:");
  (w.data || []).forEach(v => {
    const bid = v.relationships && v.relationships.build && v.relationships.build.data;
    const nr = bid ? ((w.included || []).find(x => x.id === bid.id) || { attributes: {} }).attributes.version : "—";
    console.log("  " + v.attributes.versionString + "  " + v.attributes.appStoreState + "  (budowa " + nr + ")");
  });
  console.log("BUDOWY:");
  (b.data || []).forEach(x => console.log("  " + x.attributes.version + "  " + x.attributes.processingState + "  " + x.attributes.uploadedDate));
  console.log("ZGŁOSZENIA:", (z.data || []).map(x => x.attributes.state).join(", ") || "brak otwartych");
}

async function wydaj(nrWersji, coNowego) {
  const budowy = await api("/v1/builds?filter[app]=" + APP + "&limit=5&fields[builds]=version,processingState");
  const gotowe = (budowy.data || []).filter(b => b.attributes.processingState === "VALID");
  if (!gotowe.length) throw new Error("brak gotowej budowy");
  const build = gotowe[0];
  console.log("budowa:", build.attributes.version);

  const wersja = (await api("/v1/appStoreVersions", { method: "POST", body: JSON.stringify({
    data: { type: "appStoreVersions", attributes: { platform: "IOS", versionString: nrWersji, copyright: "2026 Mateusz Będkowski", releaseType: "AFTER_APPROVAL" },
      relationships: { app: { data: { type: "apps", id: APP } } } }
  }) })).data;
  console.log("wersja", nrWersji, "utworzona");

  const lok = await api("/v1/appStoreVersions/" + wersja.id + "/appStoreVersionLocalizations");
  const pl = (lok.data || []).find(l => l.attributes.locale === "pl") || lok.data[0];
  await api("/v1/appStoreVersionLocalizations/" + pl.id, { method: "PATCH", body: JSON.stringify({
    data: { type: "appStoreVersionLocalizations", id: pl.id, attributes: { whatsNew: coNowego } } }) });

  await api("/v1/appStoreVersions/" + wersja.id, { method: "PATCH", body: JSON.stringify({
    data: { type: "appStoreVersions", id: wersja.id, attributes: { usesIdfa: false } } }) });
  await api("/v1/appStoreVersions/" + wersja.id + "/relationships/build", { method: "PATCH", body: JSON.stringify({
    data: { type: "builds", id: build.id } }) });
  console.log("opis, IDFA i budowa podpięte");

  const zgl = (await api("/v1/reviewSubmissions", { method: "POST", body: JSON.stringify({
    data: { type: "reviewSubmissions", attributes: { platform: "IOS" }, relationships: { app: { data: { type: "apps", id: APP } } } } }) })).data;
  await api("/v1/reviewSubmissionItems", { method: "POST", body: JSON.stringify({
    data: { type: "reviewSubmissionItems", relationships: { reviewSubmission: { data: { type: "reviewSubmissions", id: zgl.id } }, appStoreVersion: { data: { type: "appStoreVersions", id: wersja.id } } } } }) });
  const po = await api("/v1/reviewSubmissions/" + zgl.id, { method: "PATCH", body: JSON.stringify({
    data: { type: "reviewSubmissions", id: zgl.id, attributes: { submitted: true } } }) });
  console.log("wysłane do recenzji:", po.data.attributes.state);
}

(async () => {
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === "wydaj") {
    if (!arg) throw new Error("podaj numer wersji, np. node asc.js wydaj 1.0.4");
    await wydaj(arg, "Dyktanda czyta teraz lektor zamiast syntezatora mowy.\nDrobne poprawki.");
  } else await stan();
})().catch(e => { console.error("BŁĄD:", e.message); process.exit(2); });
