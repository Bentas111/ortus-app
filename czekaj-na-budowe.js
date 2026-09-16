// Czeka, aż w App Store Connect pojawi się nowa budowa w stanie VALID.
//   node czekaj-na-budowe.js 12
const fs = require("fs"), crypto = require("crypto");
const KEY_ID = "NHT77F5LX4", ISSUER = "839f329b-39aa-4ced-b171-7db7d67e1b7c";
const P8 = "C:\\Users\\48607\\Downloads\\AuthKey_NHT77F5LX4.p8";
const API = "https://api.appstoreconnect.apple.com", APP = "6809715926";
const CEL = process.argv[2] || "12";
const b64u = (b) => Buffer.from(b).toString("base64url");
function token() {
  const k = crypto.createPrivateKey(fs.readFileSync(P8, "utf8"));
  const h = b64u(JSON.stringify({ alg: "ES256", kid: KEY_ID, typ: "JWT" }));
  const t = Math.floor(Date.now() / 1000);
  const b = b64u(JSON.stringify({ iss: ISSUER, iat: t, exp: t + 900, aud: "appstoreconnect-v1" }));
  return h + "." + b + "." + b64u(crypto.sign(null, Buffer.from(h + "." + b), { key: k, dsaEncoding: "ieee-p1363" }));
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  for (let i = 0; i < 60; i++) {                       // do 40 minut
    const H = { Authorization: "Bearer " + token() };
    const j = await (await fetch(API + "/v1/builds?filter[app]=" + APP + "&limit=3&fields[builds]=version,processingState", { headers: H })).json();
    const b = (j.data || []).find(x => x.attributes.version === CEL);
    const stan = b ? b.attributes.processingState : "jeszcze nie wgrana";
    console.log(new Date().toTimeString().slice(0, 5), "budowa " + CEL + ":", stan);
    if (b && stan === "VALID") { console.log("GOTOWA"); return; }
    if (b && (stan === "FAILED" || stan === "INVALID")) { console.log("BUDOWA ODRZUCONA"); process.exit(3); }
    await sleep(40000);
  }
  console.log("minęło 40 minut, budowa nadal nie jest gotowa");
  process.exit(4);
})().catch(e => { console.error("BŁĄD:", e.message); process.exit(2); });
