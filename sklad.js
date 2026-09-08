// Składa 6 zrzutów z szablonem (pasek z hasłem + ramka) w pliki 1080×1920 gotowe do Google Play.
const fs = require("fs"), path = require("path"), http = require("http");
const OUT = "C:\\Users\\48607\\OneDrive\\Pulpit\\Audyt kotków\\play-grafiki";
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// serwer: szablon z ortus-app, zrzuty z katalogu docelowego
const srv = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split("?")[0]).replace(/^\//, "") || "sklad.html";
  const p = /^zrzut-/.test(u) ? path.join(OUT, u) : path.join(__dirname, u);
  fs.readFile(p, (e, d) => {
    if (e) { r.writeHead(404); r.end("404"); return; }
    r.writeHead(200, { "Content-Type": u.endsWith(".html") ? "text/html; charset=utf-8" : "image/png" });
    r.end(d);
  });
}).listen(8150);

(async () => {
  const list = await (await fetch("http://localhost:9333/json")).json();
  const pg = list.find(p => p.type === "page");
  const ws = new WebSocket(pg.webSocketDebuggerUrl);
  let id = 0; const pending = new Map();
  ws.addEventListener("message", e => { const d = JSON.parse(e.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result || d.error); pending.delete(d.id); } });
  const send = (m, p) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); });
  await new Promise(r => ws.onopen = r);
  await send("Page.enable"); await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1080, height: 1920, deviceScaleFactor: 1, mobile: false });

  for (let n = 1; n <= 6; n++) {
    await send("Page.navigate", { url: "http://localhost:8150/sklad.html?n=" + n });
    let ok = false;
    for (let i = 0; i < 40; i++) {
      await sleep(250);
      const r = await send("Runtime.evaluate", { expression: "window.gotowe===true", returnByValue: true });
      if (r.result && r.result.value) { ok = true; break; }
    }
    const shot = await send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: 1080, height: 1920, scale: 1 } });
    const plik = path.join(OUT, "play-zrzut-" + n + ".png");
    fs.writeFileSync(plik, Buffer.from(shot.data, "base64"));
    console.log("play-zrzut-" + n + ".png", ok ? "" : "(uwaga: nie doczekano na fonty)", fs.statSync(plik).size, "B");
  }
  ws.close(); srv.close(); process.exit(0);
})().catch(e => { console.error("WYJĄTEK", e); process.exit(2); });
