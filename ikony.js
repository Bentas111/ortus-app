// Eksportuje źródła ikon i ekranów startowych do assets/ (potem: npx capacitor-assets generate).
const fs = require("fs"), path = require("path"), http = require("http"), { spawn } = require("child_process");
const OUT = path.join(__dirname, "assets");
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });


(async () => {
  // Chrome uruchamiany osobno (headless, port 9338) — spawn z Node gubił ścieżkę ze spacjami
  let pg = null;
  for (let i = 0; i < 20 && !pg; i++) {
    await sleep(800);
    try { const l = await (await fetch("http://localhost:9338/json")).json(); pg = l.find(p => p.type === "page" && /ikony\.html/.test(p.url)); } catch (e) {}
  }
  if (!pg) { console.log("brak strony w Chrome"); process.exit(2); }
  const ws = new WebSocket(pg.webSocketDebuggerUrl);
  let id = 0; const P = new Map();
  ws.addEventListener("message", e => { const d = JSON.parse(e.data); if (d.id && P.has(d.id)) { P.get(d.id)(d.result || d.error); P.delete(d.id); } });
  const send = (m, p) => new Promise(r => { const i = ++id; P.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); });
  await new Promise(r => ws.onopen = r);
  await send("Page.enable"); await send("Runtime.enable");
  for (let i = 0; i < 30; i++) { await sleep(300); const r = await send("Runtime.evaluate", { expression: "window.gotowe===true", returnByValue: true }); if (r.result && r.result.value) break; }

  const eksport = async (sel, plik, przezroczyste) => {
    await send("Emulation.setDeviceMetricsOverride", { width: 1200, height: 1200, deviceScaleFactor: 1, mobile: false });
    const box = await send("Runtime.evaluate", { expression: `(()=>{const r=document.getElementById("${sel}").getBoundingClientRect();return JSON.stringify({x:r.x+scrollX,y:r.y+scrollY,w:r.width,h:r.height});})()`, returnByValue: true });
    const b = JSON.parse(box.result.value);
    const s = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, fromSurface: true, captureBeyondViewport: true, clip: { x: b.x, y: b.y, width: b.w, height: b.h, scale: 1 }, ...(przezroczyste ? { optimizeForSpeed: false } : {}) });
    fs.writeFileSync(path.join(OUT, plik), Buffer.from(s.data, "base64"));
    console.log(plik, Math.round(b.w) + "×" + Math.round(b.h), fs.statSync(path.join(OUT, plik)).size + " B");
  };
  await eksport("icon", "icon.png");
  await eksport("icon-foreground", "icon-foreground.png", true);
  await eksport("icon-background", "icon-background.png");
  await eksport("splash", "splash.png");
  await eksport("splash-dark", "splash-dark.png");
  ws.close(); process.exit(0);
})().catch(e => { console.error("WYJĄTEK", e); process.exit(2); });
