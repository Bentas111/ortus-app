// Zrzut ekranu „Bez reklam" z podstawionym sklepem — do recenzji Apple (1290 × 2796, iPhone 6,7")
// i do obejrzenia. Most do sklepu wstrzykujemy PRZED załadowaniem strony, tak jak robi to app-native.js.
//   node zrzut-sklep.js            → ekran z ofertą
//   node zrzut-sklep.js aktywny    → ekran z aktywnym abonamentem
const fs = require("fs"), path = require("path");
const OUT = "C:\\Users\\48607\\OneDrive\\Pulpit\\Audyt kotków\\posty-grafiki";
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const AKTYWNY = process.argv[2] === "aktywny";
const W = 430, H = 932;   // iPhone 14/15 Pro Max w px CSS; × 3 = 1290 × 2796

const MOST = `
window.ortusParentGate = function (cb) { cb(); };
window.ORTUS_NATIVE = true;
window.ortusSklep = {
  platforma: "apple",
  produkty: function (ids) { return Promise.resolve([
    { id: ids[0], cena: "15,99 zł", okres: "miesiąc" },
    { id: ids[1], cena: "149,99 zł", okres: "rok" } ]); },
  kup: function (id) { return Promise.resolve({ aktywnaDo: new Date(Date.now() + 30 * 864e5).toISOString(), produkt: id }); },
  przywroc: function () { return Promise.resolve(null); },
  stan: function () { return Promise.resolve(${AKTYWNY ? '{ aktywnaDo: new Date(Date.now() + 300 * 864e5).toISOString(), produkt: "pl.niekazmuliczyc.ortus.bezreklam.rok" }' : "null"}); }
};
try { localStorage.removeItem("ortus_abonament_v1"); } catch (e) {}
`;

(async () => {
  await fetch("http://localhost:9338/json/new?about:blank", { method: "PUT" });
  await sleep(1500);
  const list = await (await fetch("http://localhost:9338/json")).json();
  const pg = list.find(p => p.type === "page" && /about:blank/.test(p.url)) || list.find(p => p.type === "page");
  const ws = new WebSocket(pg.webSocketDebuggerUrl);
  let id = 0; const P = new Map();
  ws.addEventListener("message", e => { const d = JSON.parse(e.data); if (d.id && P.has(d.id)) { P.get(d.id)(d.result || d.error); P.delete(d.id); } });
  const send = (m, p) => new Promise(r => { const i = ++id; P.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); });
  await new Promise(r => ws.onopen = r);
  await send("Page.enable"); await send("Runtime.enable");
  const ev = async (x) => { const r = await send("Runtime.evaluate", { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) return "WYJĄTEK " + JSON.stringify(r.exceptionDetails.exception).slice(0, 200); return r.result ? r.result.value : null; };
  await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 3, mobile: true });
  await send("Page.addScriptToEvaluateOnNewDocument", { source: MOST });
  await send("Page.navigate", { url: "http://localhost:8149/" }); await sleep(6500);
  await ev("(()=>{const s=document.createElement('style'); s.textContent='::-webkit-scrollbar{display:none!important}'; document.head.appendChild(s);})()");
  await ev(`(()=>{const b=[...document.querySelectorAll("button")].filter(e=>e.offsetParent).find(e=>/^Zaczynajmy/.test(e.textContent.trim())); b&&b.click();})()`);
  await sleep(900);
  await ev(`(()=>{const b=[...document.querySelectorAll("button")].filter(e=>e.offsetParent).find(e=>/Bez reklam/.test(e.textContent)); b&&b.click();})()`);
  await sleep(2500);
  await ev("window.scrollTo(0,0)"); await sleep(400);

  const kontrola = await ev(`(()=>{const t=document.body.innerText; return {
    ekran:/Ortuś bez reklam/.test(t), oferty:(t.match(/15,99|149,99/g)||[]).length, aktywny:/Abonament aktywny/.test(t),
    zastrzezenie:/odnawia się automatycznie/.test(t), przywroc:/Przywróć zakupy/.test(t), wysokosc:document.body.scrollHeight };})()`);
  console.log("kontrola:", JSON.stringify(kontrola));

  const plik = path.join(OUT, AKTYWNY ? "sklep-aktywny.png" : "sklep-oferta-1290x2796.png");
  // deviceScaleFactor 3 już daje 1290 × 2796, więc scale zostaje 1
  const s = await send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: W, height: H, scale: 1 } });
  fs.writeFileSync(plik, Buffer.from(s.data, "base64"));
  const png = fs.readFileSync(plik);
  console.log("→", plik, png.readUInt32BE(16) + "×" + png.readUInt32BE(20));
  ws.close(); process.exit(0);
})().catch(e => { console.error("WYJĄTEK", e); process.exit(2); });
