// Pokazuje stan budów w App Store Connect (klucz .p8). Bez argumentów — jednorazowo.
const fs = require("fs"), crypto = require("crypto");
const KEY_ID = "NHT77F5LX4", ISSUER = "839f329b-39aa-4ced-b171-7db7d67e1b7c";
const P8 = "C:\\Users\\48607\\Downloads\\AuthKey_NHT77F5LX4.p8";
const API = "https://api.appstoreconnect.apple.com";
const b64u = (b) => Buffer.from(b).toString("base64url");
function token() {
  const klucz = crypto.createPrivateKey(fs.readFileSync(P8, "utf8"));
  const head = b64u(JSON.stringify({ alg: "ES256", kid: KEY_ID, typ: "JWT" }));
  const t = Math.floor(Date.now() / 1000);
  const body = b64u(JSON.stringify({ iss: ISSUER, iat: t, exp: t + 900, aud: "appstoreconnect-v1" }));
  return head + "." + body + "." + b64u(crypto.sign(null, Buffer.from(head + "." + body), { key: klucz, dsaEncoding: "ieee-p1363" }));
}
(async () => {
  const H = { Authorization: "Bearer " + token(), "Content-Type": "application/json" };
  const j = await (await fetch(API + "/v1/builds?filter[app]=6809715926&limit=5&fields[builds]=version,processingState,expired,uploadedDate,usesNonExemptEncryption", { headers: H })).json();
  for (const b of (j.data || [])) {
    console.log("build " + b.attributes.version + " | " + b.attributes.processingState + " | szyfrowanie: " + b.attributes.usesNonExemptEncryption);
    if (b.attributes.processingState === "VALID" && b.attributes.usesNonExemptEncryption === null) {
      const r = await fetch(API + "/v1/builds/" + b.id, { method: "PATCH", headers: H, body: JSON.stringify({ data: { type: "builds", id: b.id, attributes: { usesNonExemptEncryption: false } } }) });
      console.log("  → uzupełniono deklarację szyfrowania: " + r.status);
    }
  }
})();
