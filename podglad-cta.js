// Składa stronę podglądu z blokiem CTA i robi zrzut — żeby zobaczyć, a nie zgadywać.
const fs = require("fs"), path = require("path"), http = require("http");
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const PLIK = process.argv[2] || "C:\\Users\\48607\\OneDrive\\Pulpit\\Audyt kotków\\nkml-cta-newsletter.html";
const WYJ = path.join("C:\\Users\\48607\\OneDrive\\Pulpit\\Audyt kotków\\posty-grafiki", process.argv[3] || "podglad-cta.png");

const blok = fs.readFileSync(PLIK, "utf8");
const strona = `<!DOCTYPE html><html lang="pl"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@500;700&family=Nunito:wght@400;700;800&display=swap" rel="stylesheet">
<style>
:root{--f-head:'Quicksand',system-ui,sans-serif; --f-body:'Nunito',system-ui,sans-serif;
 --c-navy:#1A3A5C; --c-navy-700:#14304D; --c-orange:#F4A228; --c-orange-600:#E0901A;
 --c-cream:#FBF7F1; --c-cream-2:#F4EEE3; --c-ink:#26384a; --c-muted:#5C6B7A; --c-line:#EADFCB}
body{margin:0;background:#E8EEF3;font-family:var(--f-body)}
</style></head><body>${blok}
<script>/* podgląd: pokazujemy od razu, bez czekania 5 s i bez pamięci zamknięcia */
try{localStorage.removeItem('nkml_cta_grupa_fb');sessionStorage.removeItem('nkml_cta_grupa_fb_sesja');}catch(e){}
</script></body></html>`;

const srv = http.createServer((q, r) => { r.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }); r.end(strona); }).listen(8157);

(async () => {
  await fetch("http://localhost:9338/json/new?http://localhost:8157/", { method: "PUT" });
  await sleep(3500);
  const list = await (await fetch("http://localhost:9338/json")).json();
  const pg = list.find(p => p.type === "page" && /8157/.test(p.url));
  if (!pg) { console.log("brak karty podglądu"); process.exit(2); }
  const ws = new WebSocket(pg.webSocketDebuggerUrl);
  let id = 0; const P = new Map();
  ws.addEventListener("message", e => { const d = JSON.parse(e.data); if (d.id && P.has(d.id)) { P.get(d.id)(d.result || d.error); P.delete(d.id); } });
  const send = (m, p) => new Promise(r => { const i = ++id; P.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); });
  await new Promise(r => ws.onopen = r);
  await send("Page.enable"); await send("Runtime.enable");
  const ev = async (x) => { const r = await send("Runtime.evaluate", { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) return "WYJĄTEK " + JSON.stringify(r.exceptionDetails.exception).slice(0, 200); return r.result ? r.result.value : null; };
  await send("Emulation.setDeviceMetricsOverride", { width: 1200, height: 900, deviceScaleFactor: 2, mobile: false });
  await send("Page.navigate", { url: "http://localhost:8157/" }); await sleep(3000);
  await sleep(8000);   // blok pokazuje się sam po 5 s
  console.log("klasy CTA:", await ev("(document.getElementById('nkmlCta')||{}).className"));
  const box = await ev(`(()=>{const c=document.getElementById('nkmlCta'); if(!c) return null; const r=c.getBoundingClientRect();
    return {x:Math.max(0,Math.round(r.left)-8), y:Math.max(0,Math.round(r.top+window.scrollY)-8), w:Math.round(r.width)+16, h:Math.round(r.height)+16};})()`);
  const klip = box && box.h > 40 ? { x: box.x, y: box.y, width: Math.min(1200, box.w), height: box.h, scale: 2 }
                                 : { x: 0, y: 0, width: 1200, height: 900, scale: 2 };
  const sh = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: klip });
  fs.writeFileSync(WYJ, Buffer.from(sh.data, "base64"));
  console.log("→", WYJ, klip.width + "×" + klip.height);
  ws.close(); srv.close(); process.exit(0);
})().catch(e => { console.error("WYJĄTEK", e); process.exit(2); });
