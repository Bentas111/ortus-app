// Ustawia ceny abonamentów w Polsce i pozwala Apple przeliczyć resztę świata.
//   node asc-ceny-abonamentu.js            → pokazuje punkty cenowe blisko celu
//   node asc-ceny-abonamentu.js ustaw      → zapisuje ceny
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
  if (r.status >= 400) throw new Error(r.status + " " + ((j && j.errors || []).map(x => (x.detail || x.title)).join("; ") || t.slice(0, 300)));
  return j;
}

(async () => {
  const ustaw = process.argv[2] === "ustaw";
  const grupa = (await api("/v1/apps/" + APP + "/subscriptionGroups?limit=10")).data
    .find(g => g.attributes.referenceName === "Ortus bez reklam");
  const subs = (await api("/v1/subscriptionGroups/" + grupa.id + "/subscriptions?limit=20&fields[subscriptions]=productId,name,state")).data;

  for (const s of subs) {
    const cel = CEL[s.attributes.productId]; if (!cel) continue;
    let punkty = [], url = "/v1/subscriptions/" + s.id + "/pricePoints?filter[territory]=POL&limit=200";
    while (url) {
      const r = await api(url);
      punkty = punkty.concat(r.data || []);
      url = r.links && r.links.next ? r.links.next.replace(API, "") : null;
    }
    punkty.sort((a, b) => Math.abs(+a.attributes.customerPrice - cel) - Math.abs(+b.attributes.customerPrice - cel));
    console.log("\n" + s.attributes.productId, "| stan:", s.attributes.state, "| punktów:", punkty.length);
    punkty.slice(0, 3).forEach(p => console.log("   " + p.attributes.customerPrice + " PLN  (Tobie zostaje " + p.attributes.proceeds + ")"));
    const wybrany = punkty[0];
    if (!wybrany) { console.log("   brak punktów cenowych"); continue; }
    if (+wybrany.attributes.customerPrice !== cel) console.log("   UWAGA: Apple nie ma dokładnie " + cel + ", biorę " + wybrany.attributes.customerPrice);

    if (!ustaw) continue;
    await api("/v1/subscriptionPrices", { method: "POST", body: JSON.stringify({
      data: { type: "subscriptionPrices", attributes: { preserveCurrentPrice: false },
        relationships: {
          subscription: { data: { type: "subscriptions", id: s.id } },
          subscriptionPricePoint: { data: { type: "subscriptionPricePoints", id: wybrany.id } } } } }) });
    console.log("   → cena ustawiona:", wybrany.attributes.customerPrice, "PLN");
  }
  if (!ustaw) console.log("\n(to był podgląd — żeby zapisać: node asc-ceny-abonamentu.js ustaw)");
})().catch(e => { console.error("BŁĄD:", e.message); process.exit(2); });
