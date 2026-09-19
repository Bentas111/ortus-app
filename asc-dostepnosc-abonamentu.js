// Ustawia dostępność abonamentów we wszystkich krajach, a potem ceny.
// Bez dostępności Apple odrzuca każdy punkt cenowy jako nieprawidłowy.
const fs = require("fs"), crypto = require("crypto");
const KEY_ID = "NHT77F5LX4", ISSUER = "839f329b-39aa-4ced-b171-7db7d67e1b7c";
const P8 = "C:\\Users\\48607\\Downloads\\AuthKey_NHT77F5LX4.p8", APP = "6809715926";
const API = "https://api.appstoreconnect.apple.com";
const CEL = { "pl.niekazmuliczyc.ortus.bezreklam.miesiac": 15.99, "pl.niekazmuliczyc.ortus.bezreklam.rok": 149.99 };
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
  if (r.status >= 400) throw new Error(r.status + " " + ((j && j.errors || []).map(x => x.detail || x.title).join("; ") || t.slice(0, 250)));
  return j;
}

(async () => {
  // lista krajów — ta sama, w której dostępna jest sama aplikacja
  let terytoria = [], url = "/v1/territories?limit=200";
  while (url) {
    const r = await api(url);
    terytoria = terytoria.concat((r.data || []).map(x => x.id));
    url = r.links && r.links.next ? r.links.next.replace(API, "") : null;
  }
  console.log("krajów w cenniku Apple:", terytoria.length);

  const g = (await api("/v1/apps/" + APP + "/subscriptionGroups?limit=10")).data
    .find(x => x.attributes.referenceName === "Ortus bez reklam");
  const subs = (await api("/v1/subscriptionGroups/" + g.id + "/subscriptions?limit=20&fields[subscriptions]=productId,state")).data;

  for (const s of subs) {
    const cel = CEL[s.attributes.productId]; if (!cel) continue;
    console.log("\n" + s.attributes.productId);

    // 1) dostępność
    let maDostepnosc = false;
    try {
      const d = await api("/v1/subscriptions/" + s.id + "/subscriptionAvailability?include=availableTerritories&limit[availableTerritories]=1");
      maDostepnosc = !!(d && d.data);
    } catch (e) { /* brak = wyjątek albo pusto */ }
    if (maDostepnosc) console.log("  dostępność już jest");
    else {
      await api("/v1/subscriptionAvailabilities", { method: "POST", body: JSON.stringify({
        data: { type: "subscriptionAvailabilities", attributes: { availableInNewTerritories: true },
          relationships: {
            subscription: { data: { type: "subscriptions", id: s.id } },
            availableTerritories: { data: terytoria.map(t => ({ type: "territories", id: t })) } } } }) });
      console.log("  dostępność ustawiona w " + terytoria.length + " krajach");
    }

    // 2) cena
    let punkty = [], u2 = "/v1/subscriptions/" + s.id + "/pricePoints?filter[territory]=POL&limit=200";
    while (u2) {
      const r = await api(u2);
      punkty = punkty.concat(r.data || []);
      u2 = r.links && r.links.next ? r.links.next.replace(API, "") : null;
    }
    const punkt = punkty.find(p => +p.attributes.customerPrice === cel);
    if (!punkt) { console.log("  brak punktu " + cel + " PLN"); continue; }
    await api("/v1/subscriptionPrices", { method: "POST", body: JSON.stringify({
      data: { type: "subscriptionPrices", attributes: { preserveCurrentPrice: false },
        relationships: {
          subscription: { data: { type: "subscriptions", id: s.id } },
          subscriptionPricePoint: { data: { type: "subscriptionPricePoints", id: punkt.id } } } } }) });
    console.log("  cena ustawiona: " + punkt.attributes.customerPrice + " PLN (Tobie " + punkt.attributes.proceeds + ")");
  }

  console.log("\nstan po zmianach:");
  const po = (await api("/v1/subscriptionGroups/" + g.id + "/subscriptions?limit=20&fields[subscriptions]=productId,state")).data;
  po.forEach(x => console.log("  " + x.attributes.productId.padEnd(44) + x.attributes.state));
})().catch(e => { console.error("BŁĄD:", e.message); process.exit(2); });
