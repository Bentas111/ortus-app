// Eksport ikony 512×512 i baneru 1024×500 z logo.html do play-grafiki/.
const fs = require("fs"), path = require("path"), http = require("http"), { spawn } = require("child_process");
const OUT = "C:\\Users\\48607\\OneDrive\\Pulpit\\Audyt kotków\\play-grafiki";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const srv = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split("?")[0]).replace(/^\//, "") || "logo.html";
  fs.readFile(path.join(__dirname, u), (e, d) => { if (e) { r.writeHead(404); r.end("404"); return; } r.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); r.end(d); });
}).listen(8151);

(async () => {
  spawn(CHROME, ["--headless=new", "--remote-debugging-port=9334", "--window-size=1200,800", "--hide-scrollbars",
    "--force-device-scale-factor=1", "--no-first-run", "--user-data-dir=C:\\Users\\48607\\chrome-logo", "http://localhost:8151/logo.html"],
    { detached: true, stdio: "ignore" }).unref();
  let pg = null;
  for (let i = 0; i < 30 && !pg; i++) { await sleep(1000); try { const l = await (await fetch("http://localhost:9334/json")).json(); pg = l.find(p => p.type === "page" && /8151/.test(p.url)); } catch (e) {} }
  if (!pg) { console.log("Chrome nie wstał"); process.exit(2); }

  const ws = new WebSocket(pg.webSocketDebuggerUrl);
  let id = 0; const P = new Map();
  ws.addEventListener("message", e => { const d = JSON.parse(e.data); if (d.id && P.has(d.id)) { P.get(d.id)(d.result || d.error); P.delete(d.id); } });
  const send = (m, p) => new Promise(r => { const i = ++id; P.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); });
  await new Promise(r => ws.onopen = r);
  await send("Page.enable"); await send("Runtime.enable");
  for (let i = 0; i < 40; i++) { await sleep(250); const r = await send("Runtime.evaluate", { expression: "window.gotowe===true", returnByValue: true }); if (r.result && r.result.value) break; }

  const eksport = async (sel, w, h, plik) => {
    await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
    await sleep(400);
    const box = await send("Runtime.evaluate", { expression: `(()=>{const r=document.querySelector("${sel}").getBoundingClientRect();return JSON.stringify({x:r.x+window.scrollX,y:r.y+window.scrollY,w:r.width,h:r.height});})()`, returnByValue: true });
    const b = JSON.parse(box.result.value);
    const s = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: b.x, y: b.y, width: b.w, height: b.h, scale: 1 } });
    fs.writeFileSync(path.join(OUT, plik), Buffer.from(s.data, "base64"));
    console.log(plik, Math.round(b.w) + "×" + Math.round(b.h), fs.statSync(path.join(OUT, plik)).size + " B");
  };

  await eksport("#ikona", 700, 700, "play-ikona-512.png");
  await eksport("#baner", 1200, 700, "play-baner-1024x500.png");
  ws.close(); srv.close(); process.exit(0);
})().catch(e => { console.error("WYJĄTEK", e); process.exit(2); });
