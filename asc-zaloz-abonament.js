// Zakłada grupę subskrypcji i dwa abonamenty „bez reklam" (miesięczny i roczny).
// Uruchamiać raz: node asc-zaloz-abonament.js
const fs = require("fs"), crypto = require("crypto");
const KEY_ID = "NHT77F5LX4", ISSUER = "839f329b-39aa-4ced-b171-7db7d67e1b7c";
const P8 = "C:\\Users\\48607\\Downloads\\AuthKey_NHT77F5LX4.p8", APP = "6809715926";
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
async function api(s, o) {
  const r = await fetch(API + s, { headers: H(), ...o });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) {}
  if (r.status >= 400) throw new Error(r.status + " " + ((j && j.errors || []).map(x => (x.detail || x.title)).join("; ") || t.slice(0, 300)));
  return j;
}

const ABONAMENTY = [
  { id: "pl.niekazmuliczyc.ortus.bezreklam.miesiac", nazwa: "Ortuś bez reklam — miesiąc", okres: "ONE_MONTH",
    tytul: "Ortuś bez reklam", opis: "Ćwiczenia i dyktanda bez żadnych reklam." },
  { id: "pl.niekazmuliczyc.ortus.bezreklam.rok", nazwa: "Ortuś bez reklam — rok", okres: "ONE_YEAR",
    tytul: "Ortuś bez reklam — rok", opis: "Cały rok ćwiczeń i dyktand zupełnie bez reklam." }
];

(async () => {
  // 1) grupa — wspólna dla obu okresów, żeby dało się przechodzić między nimi
  let grupa = (await api("/v1/apps/" + APP + "/subscriptionGroups?limit=10")).data
    .find(g => g.attributes.referenceName === "Ortus bez reklam");
  if (!grupa) {
    grupa = (await api("/v1/subscriptionGroups", { method: "POST", body: JSON.stringify({
      data: { type: "subscriptionGroups", attributes: { referenceName: "Ortus bez reklam" },
        relationships: { app: { data: { type: "apps", id: APP } } } } }) })).data;
    console.log("grupa utworzona:", grupa.id);
  } else console.log("grupa już jest:", grupa.id);

  // nazwa grupy widoczna dla kupującego
  const gl = await api("/v1/subscriptionGroups/" + grupa.id + "/subscriptionGroupLocalizations");
  if (!(gl.data || []).some(x => x.attributes.locale === "pl")) {
    await api("/v1/subscriptionGroupLocalizations", { method: "POST", body: JSON.stringify({
      data: { type: "subscriptionGroupLocalizations", attributes: { locale: "pl", name: "Ortuś bez reklam" },
        relationships: { subscriptionGroup: { data: { type: "subscriptionGroups", id: grupa.id } } } } }) });
    console.log("nazwa grupy po polsku dodana");
  }

  // 2) same abonamenty
  const istniejace = (await api("/v1/subscriptionGroups/" + grupa.id + "/subscriptions?limit=20&fields[subscriptions]=productId,name,state")).data || [];
  for (const a of ABONAMENTY) {
    let s = istniejace.find(x => x.attributes.productId === a.id);
    if (!s) {
      s = (await api("/v1/subscriptions", { method: "POST", body: JSON.stringify({
        data: { type: "subscriptions", attributes: {
          name: a.nazwa, productId: a.id, subscriptionPeriod: a.okres, familySharable: true, groupLevel: 1,
          reviewNote: "Abonament wylacza reklamy w aplikacji. Nie odblokowuje zadnych dodatkowych cwiczen — wszystkie tresci sa dostepne za darmo." },
          relationships: { group: { data: { type: "subscriptionGroups", id: grupa.id } } } } }) })).data;
      console.log("utworzony:", a.id, "→", s.id);
    } else console.log("już jest:", a.id, "→", s.id, "|", s.attributes.state);

    const loc = await api("/v1/subscriptions/" + s.id + "/subscriptionLocalizations");
    if (!(loc.data || []).some(x => x.attributes.locale === "pl")) {
      await api("/v1/subscriptionLocalizations", { method: "POST", body: JSON.stringify({
        data: { type: "subscriptionLocalizations", attributes: { locale: "pl", name: a.tytul, description: a.opis },
          relationships: { subscription: { data: { type: "subscriptions", id: s.id } } } } }) });
      console.log("   opis po polsku dodany");
    }
  }
  console.log("\ngotowe — zostały ceny, o nie pytamy osobno");
})().catch(e => { console.error("BŁĄD:", e.message); process.exit(2); });
