// Składa grafiki do postów: szablon + zrzut → cztery pliki 1080 × 1350 (format 4:5, pod Facebooka).
const fs = require("fs"), path = require("path"), http = require("http");
const KAT = "C:\\Users\\48607\\OneDrive\\Pulpit\\Audyt kotków\\posty-grafiki";
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const srv = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split("?")[0]).replace(/^\//, "") || "sklad-fb.html";
  const p = /^fb-/.test(u) ? path.join(KAT, u) : path.join(__dirname, u);
  fs.readFile(p, (e, d) => {
    if (e) { r.writeHead(404); return r.end("404"); }
    r.writeHead(200, { "Cache-Control": "no-store", "Content-Type": u.endsWith(".html") ? "text/html; charset=utf-8" : "image/png" });
    r.end(d);
  });
}).listen(8155);

(async () => {
  await fetch("http://localhost:9338/json/new?http://localhost:8155/sklad-fb.html?n=1", { method: "PUT" });
  await sleep(4000);
  const list = await (await fetch("http://localhost:9338/json")).json();
  const pg = list.find(p => p.type === "page" && /8155/.test(p.url));
  if (!pg) { console.log("brak karty składu"); process.exit(2); }
  const ws = new WebSocket(pg.webSocketDebuggerUrl);
  let id = 0; const P = new Map();
  ws.addEventListener("message", e => { const d = JSON.parse(e.data); if (d.id && P.has(d.id)) { P.get(d.id)(d.result || d.error); P.delete(d.id); } });
  const send = (m, p) => new Promise(r => { const i = ++id; P.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); });
  await new Promise(r => ws.onopen = r);
  await send("Page.enable"); await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1080, height: 1350, deviceScaleFactor: 1, mobile: false });

  for (let n = 1; n <= 4; n++) {
    await send("Page.navigate", { url: "http://localhost:8155/sklad-fb.html?n=" + n + "&v=" + Date.now() });
    let ok = false;
    for (let i = 0; i < 60; i++) { await sleep(250); const r = await send("Runtime.evaluate", { expression: "window.gotowe===true", returnByValue: true }); if (r.result && r.result.value) { ok = true; break; } }
    const s = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: 1080, height: 1350, scale: 1 } });
    const plik = path.join(KAT, "post-" + n + ".png");
    fs.writeFileSync(plik, Buffer.from(s.data, "base64"));
    console.log("post-" + n + ".png", ok ? "" : "(bez potwierdzenia fontów)", fs.statSync(plik).size + " B");
  }
  ws.close(); srv.close(); process.exit(0);
})().catch(e => { console.error("WYJĄTEK", e); process.exit(2); });
