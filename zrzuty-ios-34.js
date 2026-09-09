// Poprawia dwa zrzuty App Store: dyktando i regułę. Okno w proporcji telefonu,
// żeby treść wypełniała ramkę bez pustych pasów.
const fs = require("fs"), path = require("path");
const OUT = "C:\\Users\\48607\\OneDrive\\Pulpit\\Audyt kotków\\play-grafiki\\ios";
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const W = 430, H = Math.round(430 * 2166 / 990);

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
  const okno = async () => { await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 2, mobile: true }); await sleep(600); };
  const shot = async (n) => { const r = await send("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(path.join(OUT, "ios-" + n + ".png"), Buffer.from(r.data, "base64")); console.log("   → ios-" + n + ".png"); };
  const tryb = async (t, ms) => {
    await okno();
    await send("Page.navigate", { url: "http://localhost:8149/?tryb=" + t + "&klasa=3" }); await sleep(ms || 5000);
    await ev(`(()=>{const b=[...document.querySelectorAll("button")].filter(e=>e.offsetParent!==null).find(e=>/^Zaczynajmy/.test(e.textContent.trim())); b&&b.click();})()`);
    await sleep(800); await ev("window.scrollTo(0,0)"); await sleep(400);
  };
  const POPRAWNA = `(()=>{const t=document.body.innerText;
    const m=/Jak zapiszemy to wyrażenie\\?\\s*\\n\\s*nie\\s+([^\\n]+)/.exec(t)||/\\bnie\\s+([a-ząćęłńóśźż]+)\\s*\\n/i.exec(t);
    if(!m)return null; const w=m[1].trim().toLowerCase();
    const B=(window.ORTUS_WORDS||[]).filter(r=>(r[1]||"").split(",").map(s=>s.trim()).includes("nie"));
    if(B.some(r=>r[0].toLowerCase()==="nie"+w))return "razem";
    if(B.some(r=>r[0].toLowerCase()==="nie "+w))return "osobno";
    return null;})()`;

  console.log("3. dyktando");
  await tryb("dyktando", 7000);
  await shot(3);

  console.log("4. reguła");
  await tryb("nie");
  for (let i = 0; i < 16; i++) {
    const dobra = await ev(POPRAWNA);
    if (dobra) { console.log("   klikam:", await ev(`(()=>{const b=[...document.querySelectorAll("button")].filter(x=>x.offsetParent!==null).find(x=>x.textContent.trim()===${JSON.stringify(dobra)}); if(!b)return "BRAK"; b.click(); return b.textContent.trim();})()`)); break; }
    await ev(`(()=>{const b=[...document.querySelectorAll("button")].filter(x=>x.offsetParent!==null); const a=b.find(x=>/^(razem|osobno)$/.test(x.textContent.trim())); a&&a.click();})()`);
    await sleep(450);
    await ev(`(()=>{const b=[...document.querySelectorAll("button")].filter(x=>x.offsetParent!==null).find(x=>/^Dalej/.test(x.textContent.trim())); b&&b.click();})()`);
    await sleep(450);
  }
  await sleep(1200);
  console.log("   reguła:", await ev(`(()=>{const c=[...document.querySelectorAll("button,summary,a,div,span")].filter(e=>e.offsetParent!==null&&/Dlaczego tak się pisze/.test(e.textContent));
    const el=c.reverse().find(e=>![...e.children].some(k=>/Dlaczego tak się pisze/.test(k.textContent)));
    if(!el)return "BRAK"; (el.closest("button,summary,a")||el).click(); return (el.tagName+" "+el.textContent.trim()).slice(0,40);})()`));
  await sleep(1000); await ev("window.scrollTo(0,0)"); await sleep(400);
  console.log("   treść:", await ev(`document.body.innerText.replace(/\\s+/g," ").slice(0,220)`));
  await shot(4);
  ws.close(); process.exit(0);
})().catch(e => { console.error("WYJĄTEK", e); process.exit(2); });
