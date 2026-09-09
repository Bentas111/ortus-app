// Składa zrzuty App Store: szablon + zrzut → sześć plików 1290×2796.
const fs = require("fs"), path = require("path"), http = require("http");
const IOS = "C:\\Users\\48607\\OneDrive\\Pulpit\\Audyt kotków\\play-grafiki\\ios";
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const srv = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split("?")[0]).replace(/^\//, "") || "sklad-ios.html";
  const p = /^ios-/.test(u) ? path.join(IOS, u) : path.join(__dirname, u);
  fs.readFile(p, (e, d) => {
    if (e) { r.writeHead(404); r.end("404"); return; }
    r.writeHead(200, { "Cache-Control": "no-store", "Content-Type": u.endsWith(".html") ? "text/html; charset=utf-8" : "image/png" });
    r.end(d);
  });
}).listen(8154);

(async () => {
  await fetch("http://localhost:9338/json/new?http://localhost:8154/sklad-ios.html?n=1", { method: "PUT" });
  await sleep(4000);
  const list = await (await fetch("http://localhost:9338/json")).json();
  const pg = list.find(p => p.type === "page" && /8154/.test(p.url));
  if (!pg) { console.log("brak karty składu"); process.exit(2); }
  const ws = new WebSocket(pg.webSocketDebuggerUrl);
  let id = 0; const P = new Map();
  ws.addEventListener("message", e => { const d = JSON.parse(e.data); if (d.id && P.has(d.id)) { P.get(d.id)(d.result || d.error); P.delete(d.id); } });
  const send = (m, p) => new Promise(r => { const i = ++id; P.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); });
  await new Promise(r => ws.onopen = r);
  await send("Page.enable"); await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1290, height: 2796, deviceScaleFactor: 1, mobile: false });

  for (let n = 1; n <= 6; n++) {
    await send("Page.navigate", { url: "http://localhost:8154/sklad-ios.html?n=" + n + "&v=" + Date.now() });
    let ok = false;
    for (let i = 0; i < 50; i++) { await sleep(250); const r = await send("Runtime.evaluate", { expression: "window.gotowe===true", returnByValue: true }); if (r.result && r.result.value) { ok = true; break; } }
    const s = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: 1290, height: 2796, scale: 1 } });
    const plik = path.join(IOS, "appstore-" + n + ".png");
    fs.writeFileSync(plik, Buffer.from(s.data, "base64"));
    console.log("appstore-" + n + ".png", ok ? "" : "(bez potwierdzenia fontów)", fs.statSync(plik).size + " B");
  }
  ws.close(); srv.close(); process.exit(0);
})().catch(e => { console.error("WYJĄTEK", e); process.exit(2); });
