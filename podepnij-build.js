// Podpina najnowszą budowę do wersji 1.0.2 w App Store Connect.
const fs = require("fs"), crypto = require("crypto");
const KEY_ID = "NHT77F5LX4", ISSUER = "839f329b-39aa-4ced-b171-7db7d67e1b7c";
const P8 = "C:\\Users\\48607\\Downloads\\AuthKey_NHT77F5LX4.p8";
const WERSJA = "8ce14525-8de9-4470-a7f2-f354c15a227b";
const API = "https://api.appstoreconnect.apple.com";
const b64u = (b) => Buffer.from(b).toString("base64url");
const klucz = crypto.createPrivateKey(fs.readFileSync(P8, "utf8"));
const head = b64u(JSON.stringify({ alg: "ES256", kid: KEY_ID, typ: "JWT" }));
const t = Math.floor(Date.now() / 1000);
const body = b64u(JSON.stringify({ iss: ISSUER, iat: t, exp: t + 900, aud: "appstoreconnect-v1" }));
const jwt = head + "." + body + "." + b64u(crypto.sign(null, Buffer.from(head + "." + body), { key: klucz, dsaEncoding: "ieee-p1363" }));
const H = { Authorization: "Bearer " + jwt, "Content-Type": "application/json" };

(async () => {
  const j = await (await fetch(API + "/v1/builds?filter[app]=6809715926&limit=5&fields[builds]=version,processingState", { headers: H })).json();
  const b5 = (j.data || []).find(x => x.attributes.version === "7");
  if (!b5) { console.log("brak budowy 5"); return; }
  const r = await fetch(API + "/v1/appStoreVersions/" + WERSJA + "/relationships/build", {
    method: "PATCH", headers: H, body: JSON.stringify({ data: { type: "builds", id: b5.id } })
  });
  console.log("podpięcie:", r.status, r.status >= 400 ? (await r.text()).slice(0, 300) : "ok");
  const c = await (await fetch(API + "/v1/appStoreVersions/" + WERSJA + "/build?fields[builds]=version", { headers: H })).json();
  console.log("w wersji 1.0.2 siedzi build:", c.data && c.data.attributes && c.data.attributes.version);
})();
