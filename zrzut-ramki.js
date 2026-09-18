// Zrzut jednej ramki ze strony — do obejrzenia, czy wygląda tak, jak miała.
//   node zrzut-ramki.js "Ortuś jest też aplikacją" ramka.png
const fs = require("fs"), path = require("path");
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const SZUKAJ = process.argv[2] || "Ortuś jest też aplikacją";
const PLIK = path.join("C:\\Users\\48607\\OneDrive\\Pulpit\\Audyt kotków\\posty-grafiki", process.argv[3] || "ramka.png");

(async () => {
  await fetch("http://localhost:9338/json/new?http://localhost:8149/", { method: "PUT" });
  await sleep(4000);
  const list = await (await fetch("http://localhost:9338/json")).json();
  const pg = list.find(p => p.type === "page" && /localhost:8149/.test(p.url));
  if (!pg) { console.log("brak strony"); process.exit(2); }
  const ws = new WebSocket(pg.webSocketDebuggerUrl);
  let id = 0; const P = new Map();
  ws.addEventListener("message", e => { const d = JSON.parse(e.data); if (d.id && P.has(d.id)) { P.get(d.id)(d.result || d.error); P.delete(d.id); } });
  const send = (m, p) => new Promise(r => { const i = ++id; P.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); });
  await new Promise(r => ws.onopen = r);
  await send("Page.enable"); await send("Runtime.enable");
  const ev = async (x) => { const r = await send("Runtime.evaluate", { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) return "WYJĄTEK " + JSON.stringify(r.exceptionDetails.exception).slice(0, 200); return r.result ? r.result.value : null; };
  await send("Emulation.setDeviceMetricsOverride", { width: 430, height: 900, deviceScaleFactor: 2, mobile: true });
  await send("Page.navigate", { url: "http://localhost:8149/" }); await sleep(6500);
  await ev(`(()=>{const b=[...document.querySelectorAll("button")].filter(e=>e.offsetParent).find(e=>/^Zaczynajmy/.test(e.textContent.trim())); b&&b.click();})()`);
  await sleep(1500);
  // --android: udajemy, że aplikacja jest już w Google Play, żeby obejrzeć obie plakietki naraz
  if (process.argv.includes("--android")) {
    await ev(`(()=>{window.ORTUS_SKLEPY.android="https://play.google.com/store/apps/details?id=pl.niekazmuliczyc.ortus";
      const b=[...document.querySelectorAll("button")].filter(e=>e.offsetParent).find(e=>/Dźwięk/.test(e.textContent));
      if(b){b.click(); setTimeout(()=>b.click(),120);} })()`);
    await sleep(1800);
  }

  const box = await ev(`(()=>{const w=${JSON.stringify(SZUKAJ)};
    const c=[...document.querySelectorAll("div")].filter(d=>d.offsetParent&&d.textContent.includes(w));
    const el=c[c.length-1]; if(!el) return null;
    const ramka=el.closest("div[style*='border-radius']")||el.parentElement;
    const r=ramka.getBoundingClientRect();
    return {x:Math.max(0,Math.round(r.left)-10), y:Math.round(r.top+window.scrollY)-10,
            w:Math.min(430,Math.round(r.width)+20), h:Math.round(r.height)+20};})()`);
  if (!box) { console.log("nie znaleziono ramki"); process.exit(3); }
  const s = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: box.x, y: box.y, width: box.w, height: box.h, scale: 2 } });
  fs.writeFileSync(PLIK, Buffer.from(s.data, "base64"));
  console.log("→", PLIK, box.w + "×" + box.h + " css");
  ws.close(); process.exit(0);
})().catch(e => { console.error("WYJĄTEK", e); process.exit(2); });
