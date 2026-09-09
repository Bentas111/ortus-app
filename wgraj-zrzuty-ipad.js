// Wgrywa zrzuty na iPada do App Store Connect przez oficjalne API (klucz .p8).
const fs = require("fs"), path = require("path"), crypto = require("crypto");

const KEY_ID = "NHT77F5LX4";
const ISSUER = "839f329b-39aa-4ced-b171-7db7d67e1b7c";
const P8 = "C:\\Users\\48607\\Downloads\\AuthKey_NHT77F5LX4.p8";
const WERSJA = "8ce14525-8de9-4470-a7f2-f354c15a227b";
const KAT = "C:\\Users\\48607\\OneDrive\\Pulpit\\Audyt kotków\\play-grafiki\\ios";
const TYP = "APP_IPAD_PRO_3GEN_129";           // iPad 12,9" / 13"
const API = "https://api.appstoreconnect.apple.com";

const b64u = (b) => Buffer.from(b).toString("base64url");
function token() {
  const klucz = crypto.createPrivateKey(fs.readFileSync(P8, "utf8"));
  const head = b64u(JSON.stringify({ alg: "ES256", kid: KEY_ID, typ: "JWT" }));
  const teraz = Math.floor(Date.now() / 1000);
  const body = b64u(JSON.stringify({ iss: ISSUER, iat: teraz, exp: teraz + 1200, aud: "appstoreconnect-v1" }));
  const sig = crypto.sign(null, Buffer.from(head + "." + body), { key: klucz, dsaEncoding: "ieee-p1363" });
  return head + "." + body + "." + b64u(sig);
}
const T = token();
const H = { Authorization: "Bearer " + T, "Content-Type": "application/json" };

async function api(sciezka, opcje) {
  const r = await fetch(API + sciezka, { headers: H, ...opcje });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch (e) {}
  if (r.status >= 400) throw new Error(sciezka + " → " + r.status + " " + t.slice(0, 400));
  return j;
}

(async () => {
  const lok = await api("/v1/appStoreVersions/" + WERSJA + "/appStoreVersionLocalizations");
  const pl = lok.data.find(l => l.attributes.locale === "pl") || lok.data[0];
  console.log("lokalizacja:", pl.attributes.locale, pl.id);

  const zestawy = await api("/v1/appStoreVersionLocalizations/" + pl.id + "/appScreenshotSets");
  let set = zestawy.data.find(s => s.attributes.screenshotDisplayType === TYP);
  if (!set) {
    set = (await api("/v1/appScreenshotSets", { method: "POST", body: JSON.stringify({
      data: { type: "appScreenshotSets", attributes: { screenshotDisplayType: TYP },
        relationships: { appStoreVersionLocalization: { data: { type: "appStoreVersionLocalizations", id: pl.id } } } }
    }) })).data;
    console.log("utworzono zestaw", set.id);
  } else console.log("zestaw istnieje", set.id);

  for (let n = 1; n <= 6; n++) {
    const nazwa = "appstore-ipad-" + n + ".png";
    const dane = fs.readFileSync(path.join(KAT, nazwa));
    const rez = (await api("/v1/appScreenshots", { method: "POST", body: JSON.stringify({
      data: { type: "appScreenshots", attributes: { fileSize: dane.length, fileName: nazwa },
        relationships: { appScreenshotSet: { data: { type: "appScreenshotSets", id: set.id } } } }
    }) })).data;

    for (const op of rez.attributes.uploadOperations) {
      const naglowki = {}; (op.requestHeaders || []).forEach(h => naglowki[h.name] = h.value);
      const r = await fetch(op.url, { method: op.method, headers: naglowki, body: dane.subarray(op.offset, op.offset + op.length) });
      if (!r.ok) throw new Error("wysyłka " + nazwa + " → " + r.status + " " + (await r.text()).slice(0, 200));
    }
    const suma = crypto.createHash("md5").update(dane).digest("hex");
    await api("/v1/appScreenshots/" + rez.id, { method: "PATCH", body: JSON.stringify({
      data: { type: "appScreenshots", id: rez.id, attributes: { uploaded: true, sourceFileChecksum: suma } }
    }) });
    console.log("  wgrano", nazwa, Math.round(dane.length / 1024) + " kB");
  }

  const stan = await api("/v1/appScreenshotSets/" + set.id + "/appScreenshots");
  console.log("\nw zestawie:", stan.data.map(s => s.attributes.fileName + " " + s.attributes.assetDeliveryState.state).join(", "));
})().catch(e => { console.error("BŁĄD:", e.message); process.exit(2); });
