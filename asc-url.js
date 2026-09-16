// Podgląd adresów w wpisie App Store (potrzebne AdMob do weryfikacji app-ads.txt).
const fs = require("fs"), crypto = require("crypto");
const KEY_ID = "NHT77F5LX4", ISSUER = "839f329b-39aa-4ced-b171-7db7d67e1b7c";
const P8 = "C:\\Users\\48607\\Downloads\\AuthKey_NHT77F5LX4.p8", APP = "6809715926";
const API = "https://api.appstoreconnect.apple.com";
const b64u = (b) => Buffer.from(b).toString("base64url");
const k = crypto.createPrivateKey(fs.readFileSync(P8, "utf8"));
const h = b64u(JSON.stringify({ alg: "ES256", kid: KEY_ID, typ: "JWT" })), t = Math.floor(Date.now() / 1e3);
const b = b64u(JSON.stringify({ iss: ISSUER, iat: t, exp: t + 900, aud: "appstoreconnect-v1" }));
const jwt = h + "." + b + "." + b64u(crypto.sign(null, Buffer.from(h + "." + b), { key: k, dsaEncoding: "ieee-p1363" }));
const H = { Authorization: "Bearer " + jwt };

(async () => {
  const v = await (await fetch(API + "/v1/apps/" + APP + "/appStoreVersions?limit=1&fields[appStoreVersions]=versionString", { headers: H })).json();
  const id = v.data[0].id;
  const l = await (await fetch(API + "/v1/appStoreVersions/" + id + "/appStoreVersionLocalizations?fields[appStoreVersionLocalizations]=locale,marketingUrl,supportUrl", { headers: H })).json();
  (l.data || []).forEach(x => console.log(x.attributes.locale, "| marketing:", x.attributes.marketingUrl, "| support:", x.attributes.supportUrl));
})();
