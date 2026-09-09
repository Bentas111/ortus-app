// Zrzut nr 5 (podsumowanie): dobiera szerokość okna tak, żeby treść wypełniła ramkę.
const fs = require("fs"), path = require("path");
const OUT = "C:\\Users\\48607\\OneDrive\\Pulpit\\Audyt kotków\\play-grafiki\\ios";
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const R = 2166 / 990;

(async () => {
  const list = await (await fetch("http://localhost:9338/json")).json();
  const pg = list.find(p => p.type === "page" && /localhost:8149/.test(p.url));
  if (!pg) { console.log("brak strony aplikacji"); process.exit(2); }
  const ws = new WebSocket(pg.webSocketDebuggerUrl);
  let id = 0; const P = new Map();
  ws.addEventListener("message", e => { const d = JSON.parse(e.data); if (d.id && P.has(d.id)) { P.get(d.id)(d.result || d.error); P.delete(d.id); } });
  const send = (m, p) => new Promise(r => { const i = ++id; P.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); });
  await new Promise(r => ws.onopen = r);
  await send("Page.enable"); await send("Runtime.enable");
  const ev = async (x) => { const r = await send("Runtime.evaluate", { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) return "EXC " + JSON.stringify(r.exceptionDetails.exception).slice(0, 140); return r.result ? r.result.value : r; };
  const okno = async (w, h) => { await send("Emulation.setDeviceMetricsOverride", { width: w, height: h || Math.round(w * R), deviceScaleFactor: 2, mobile: true }); await sleep(500); };

  const POPRAWNA = `(()=>{const t=document.body.innerText;
    const m=/Jak zapiszemy to wyrażenie\\?\\s*\\n\\s*nie\\s+([^\\n]+)/.exec(t)||/\\bnie\\s+([a-ząćęłńóśźż]+)\\s*\\n/i.exec(t);
    if(!m)return null; const w=m[1].trim().toLowerCase();
    const B=(window.ORTUS_WORDS||[]).filter(r=>(r[1]||"").split(",").map(s=>s.trim()).includes("nie"));
    if(B.some(r=>r[0].toLowerCase()==="nie"+w))return "razem";
    if(B.some(r=>r[0].toLowerCase()==="nie "+w))return "osobno";
    return null;})()`;

  await okno(600);
  await send("Page.navigate", { url: "http://localhost:8149/?tryb=nie&klasa=3" }); await sleep(5000);
  await ev(`(()=>{const b=[...document.querySelectorAll("button")].filter(e=>e.offsetParent!==null).find(e=>/^Zaczynajmy/.test(e.textContent.trim())); b&&b.click();})()`);
  await sleep(900);
  for (let i = 0; i < 40; i++) {
    const r = await ev(`(()=>{const vis=[...document.querySelectorAll("button")].filter(b=>b.offsetParent!==null);
      const next=vis.find(b=>/^(Dalej|Następne|Zobacz wynik|Kolejne)/i.test(b.textContent.trim()));
      if(next){next.click(); return "dalej";}
      const dobra=${POPRAWNA};
      const ans=vis.find(x=>x.textContent.trim()===dobra)||vis.find(x=>/^(razem|osobno)$/.test(x.textContent.trim()));
      if(ans){ans.click(); return "odp";}
      return "koniec";})()`);
    if (r === "koniec") break;
    await sleep(360);
  }
  await sleep(1800);

  // dobór szerokości: szukamy takiej, przy której wysokość treści trafia w proporcję ramki
  let best = null;
  for (const w of [430, 500, 560, 620, 700, 800, 900, 990]) {
    await okno(w, 3000);
    const h = await ev(`(()=>{let b=0;document.querySelectorAll("body *").forEach(e=>{if(e.children.length)return;const r=e.getBoundingClientRect(); if(r.width>0&&r.height>0&&r.bottom>b)b=r.bottom;}); return Math.ceil(b)+28;})()`);
    const cel = Math.round(w * R);
    console.log("   szer.", w, "treść", h, "ramka", cel);
    if (!best || Math.abs(h / cel - 1) < Math.abs(best.f - 1)) best = { w, f: h / cel };
  }
  const w = best ? best.w : 620;
  console.log("   wybieram", w, "(wypełnienie " + Math.round(best.f * 100) + "%)");
  await okno(w);
  await ev("window.scrollTo(0,0)"); await sleep(500);
  const s = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(OUT, "ios-5.png"), Buffer.from(s.data, "base64"));
  console.log("   → ios-5.png");
  ws.close(); process.exit(0);
})().catch(e => { console.error("WYJĄTEK", e); process.exit(2); });
