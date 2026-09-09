// Szuka elementów, które wystają poza szerokość ekranu (poziome przewijanie).
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const SZEROKOSCI = [393, 402, 428, 440];
const EKRANY = ["/", "/?tryb=nie&klasa=3", "/?tryb=dyktando&klasa=3", "/?tryb=przecinki&klasa=3", "/?tryb=egzamin&klasa=5"];

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
  const ev = async (x) => { const r = await send("Runtime.evaluate", { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) return "EXC " + JSON.stringify(r.exceptionDetails.exception).slice(0, 200); return r.result ? r.result.value : r; };

  const WINOWAJCY = `(()=>{
    const w = document.documentElement.clientWidth;
    const nadmiar = document.documentElement.scrollWidth - w;
    if (nadmiar <= 0) return {nadmiar:0, lista:[]};
    const out = [];
    document.querySelectorAll("body *").forEach(e=>{
      const r = e.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      const prawa = r.right + window.scrollX, lewa = r.left + window.scrollX;
      if (prawa > w + 1 || lewa < -1) {
        // interesuje nas najgłębszy element, nie każdy rodzic
        if ([...e.children].some(c=>{const cr=c.getBoundingClientRect(); return cr.right+window.scrollX>w+1 || cr.left+window.scrollX<-1;})) return;
        out.push({
          tag: e.tagName.toLowerCase(),
          tekst: (e.textContent||"").replace(/\\s+/g," ").trim().slice(0,45),
          lewa: Math.round(lewa), prawa: Math.round(prawa), szer: Math.round(r.width),
          styl: (e.getAttribute("style")||"").slice(0,90)
        });
      }
    });
    return {nadmiar, lista: out.slice(0,6)};
  })()`;

  for (const ekran of EKRANY) {
    for (const w of SZEROKOSCI) {
      await send("Emulation.setDeviceMetricsOverride", { width: w, height: 820, deviceScaleFactor: 2, mobile: true });
      await send("Page.navigate", { url: "http://localhost:8149" + ekran });
      await sleep(ekran === "/" ? 5000 : 4500);
      await ev(`(()=>{const b=[...document.querySelectorAll("button")].find(e=>/^Zaczynajmy/.test(e.textContent.trim())); b&&b.click();})()`);
      await sleep(900);
      const r = await ev(WINOWAJCY);
      if (r && r.nadmiar > 0) {
        console.log(ekran + " @" + w + "px — wystaje o " + r.nadmiar + " px");
        (r.lista || []).forEach(x => console.log("    " + x.tag + " [" + x.lewa + "→" + x.prawa + ", szer " + x.szer + "] „" + x.tekst + "”  " + x.styl));
      } else {
        console.log(ekran + " @" + w + "px — ok");
      }
    }
  }
  ws.close(); process.exit(0);
})().catch(e => { console.error("WYJĄTEK", e); process.exit(2); });
