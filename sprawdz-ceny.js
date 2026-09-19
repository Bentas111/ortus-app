// Czy ceny abonamentów faktycznie są zapisane po stronie Apple.
const fs = require("fs"), crypto = require("crypto");
const KEY_ID = "NHT77F5LX4", ISSUER = "839f329b-39aa-4ced-b171-7db7d67e1b7c";
const P8 = "C:\\Users\\48607\\Downloads\\AuthKey_NHT77F5LX4.p8", APP = "6809715926";
const API = "https://api.appstoreconnect.apple.com";
const b64u = (b) => Buffer.from(b).toString("base64url");
function tok() {
  const k = crypto.createPrivateKey(fs.readFileSync(P8, "utf8"));
  const h = b64u(JSON.stringify({ alg: "ES256", kid: KEY_ID, typ: "JWT" }));
  const t = Math.floor(Date.now() / 1000);
  const b = b64u(JSON.stringify({ iss: ISSUER, iat: t, exp: t + 900, aud: "appstoreconnect-v1" }));
  return h + "." + b + "." + b64u(crypto.sign(null, Buffer.from(h + "." + b), { key: k, dsaEncoding: "ieee-p1363" }));
}
const get = async (s) => (await (await fetch(API + s, { headers: { Authorization: "Bearer " + tok() } })).json());

(async () => {
  const g = (await get("/v1/apps/" + APP + "/subscriptionGroups?limit=10")).data
    .find(x => x.attributes.referenceName === "Ortus bez reklam");
  const subs = (await get("/v1/subscriptionGroups/" + g.id + "/subscriptions?limit=20&fields[subscriptions]=productId,state")).data;
  for (const s of subs) {
    const p = await get("/v1/subscriptions/" + s.id + "/prices?include=subscriptionPricePoint&limit=5");
    const ceny = (p.included || []).filter(x => x.type === "subscriptionPricePoints")
      .map(x => x.attributes.customerPrice + " PLN (Tobie " + x.attributes.proceeds + ")");
    const d = await get("/v1/subscriptions/" + s.id + "/subscriptionAvailability?include=availableTerritories");
    const kraje = d && d.included ? d.included.length : (d && d.data ? "ustawiona" : "BRAK");
    console.log("  " + s.attributes.productId.padEnd(44) + s.attributes.state.padEnd(18) +
      "cen: " + (p.data || []).length + "  " + ceny.join(", ") + "  | krajów: " + kraje);
  }
})();
