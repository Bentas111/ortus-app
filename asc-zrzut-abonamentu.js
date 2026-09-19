// Wgrywa zrzut ekranu zakupu do „App Review Information" obu abonamentów.
// Ten sam mechanizm co przy zrzutach sklepowych: rezerwacja → wysyłka części → potwierdzenie z sumą MD5.
const fs = require("fs"), crypto = require("crypto"), path = require("path");
const KEY_ID = "NHT77F5LX4", ISSUER = "839f329b-39aa-4ced-b171-7db7d67e1b7c";
const P8 = "C:\\Users\\48607\\Downloads\\AuthKey_NHT77F5LX4.p8", APP = "6809715926";
const API = "https://api.appstoreconnect.apple.com";
const PLIK = "C:\\Users\\48607\\OneDrive\\Pulpit\\Audyt kotków\\posty-grafiki\\sklep-oferta-1290x2796.png";
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
  const dane = fs.readFileSync(PLIK);
  const md5 = crypto.createHash("md5").update(dane).digest("hex");
  console.log("plik:", path.basename(PLIK), dane.length, "B | md5", md5);

  const g = (await api("/v1/apps/" + APP + "/subscriptionGroups?limit=10")).data
    .find(x => x.attributes.referenceName === "Ortus bez reklam");
  const subs = (await api("/v1/subscriptionGroups/" + g.id + "/subscriptions?limit=20&fields[subscriptions]=productId,state")).data;

  for (const s of subs) {
    console.log("\n" + s.attributes.productId);
    // istniejący zrzut? — usuwamy, żeby nie zostawić starego
    try {
      const st = await api("/v1/subscriptions/" + s.id + "/appStoreReviewScreenshot");
      if (st && st.data && st.data.id) {
        await api("/v1/subscriptionAppStoreReviewScreenshots/" + st.data.id, { method: "DELETE" });
        console.log("  stary zrzut usunięty");
      }
    } catch (e) { /* brak = w porządku */ }

    const rez = (await api("/v1/subscriptionAppStoreReviewScreenshots", { method: "POST", body: JSON.stringify({
      data: { type: "subscriptionAppStoreReviewScreenshots",
        attributes: { fileName: path.basename(PLIK), fileSize: dane.length },
        relationships: { subscription: { data: { type: "subscriptions", id: s.id } } } } }) })).data;
    const ops = rez.attributes.uploadOperations || [];
    console.log("  zarezerwowano, części do wysłania:", ops.length);
    for (const op of ops) {
      const czesc = dane.subarray(op.offset, op.offset + op.length);
      const nagl = {}; (op.requestHeaders || []).forEach(h => nagl[h.name] = h.value);
      const r = await fetch(op.url, { method: op.method, headers: nagl, body: czesc });
      if (r.status >= 400) throw new Error("wysyłka części: " + r.status + " " + (await r.text()).slice(0, 200));
    }
    const po = await api("/v1/subscriptionAppStoreReviewScreenshots/" + rez.id, { method: "PATCH", body: JSON.stringify({
      data: { type: "subscriptionAppStoreReviewScreenshots", id: rez.id, attributes: { uploaded: true, sourceFileChecksum: md5 } } }) });
    const a = po.data.attributes;
    console.log("  stan:", a.assetDeliveryState ? a.assetDeliveryState.state : "?");
  }
})().catch(e => { console.error("BŁĄD:", e.message); process.exit(2); });
