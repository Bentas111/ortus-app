// Wysyła istniejącą wersję do recenzji (gdy wersja już powstała, a samo zgłoszenie padło).
//   node wyslij-do-recenzji.js 1.0.5
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

(async () => {
  const nr = process.argv[2] || "1.0.5";
  const w = await api("/v1/apps/" + APP + "/appStoreVersions?limit=10&fields[appStoreVersions]=versionString,appStoreState");
  const v = (w.data || []).find(x => x.attributes.versionString === nr);
  if (!v) throw new Error("nie ma wersji " + nr);
  console.log("wersja", nr, "stan:", v.attributes.appStoreState);

  // sprzątamy porzucone zgłoszenia, żeby nie blokowały nowego
  const otw = await api("/v1/reviewSubmissions?filter[app]=" + APP + "&filter[state]=READY_FOR_REVIEW&limit=10&fields[reviewSubmissions]=state");
  for (const z of (otw.data || [])) {
    console.log("porzucone zgłoszenie", z.id, "—", z.attributes.state);
  }

  const zgl = (await api("/v1/reviewSubmissions", { method: "POST", body: JSON.stringify({
    data: { type: "reviewSubmissions", attributes: { platform: "IOS" }, relationships: { app: { data: { type: "apps", id: APP } } } } }) })).data;
  await api("/v1/reviewSubmissionItems", { method: "POST", body: JSON.stringify({
    data: { type: "reviewSubmissionItems", relationships: {
      reviewSubmission: { data: { type: "reviewSubmissions", id: zgl.id } },
      appStoreVersion: { data: { type: "appStoreVersions", id: v.id } } } } }) });
  const po = await api("/v1/reviewSubmissions/" + zgl.id, { method: "PATCH", body: JSON.stringify({
    data: { type: "reviewSubmissions", id: zgl.id, attributes: { submitted: true } } }) });
  console.log("wysłane do recenzji:", po.data.attributes.state);
})().catch(e => { console.error("BŁĄD:", e.message); process.exit(2); });
