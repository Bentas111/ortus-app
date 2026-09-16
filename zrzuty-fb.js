// Surowe zrzuty ekranów Ortusia do postów na Facebooka.
// Każdy kadr przycinamy do faktycznej treści — bez pustego tła pod kartą.
const fs = require("fs"), path = require("path");
const OUT = "C:\\Users\\48607\\OneDrive\\Pulpit\\Audyt kotków\\posty-grafiki";
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const W = 430;

const PROFIL = JSON.stringify({
  xp: 5605, streak: 12, lessons: 31, dictations: 4, perfect: 9, bestCombo: 14, goals: 8, exams: 2, topGrade: 5,
  entered: true, guest: true, onboarded: true,
  badges: { start: 1, first: 1, streak3: 1, streak7: 1, xp500: 1, xp2500: 1, coll25: 1, coll100: 1, perfect1: 1, perfect5: 1, mode3: 1, dict1: 1 },
  modes: { fill: 1, choose: 1, nie: 1, case: 1, comma: 1, trap: 1, textdict: 1, study: 1 },
  todayDay: "2026-9-16", todayXp: 180, lastDay: "2026-9-16", weekKey: "2026-W38", weekXp: 1240,
  week: { key: "2026-W38", xp: 1240, lessons: 7, dictations: 2, words: { ok: 34, total: 41 },
    skills: { ou: { ok: 41, total: 46 }, rzz: { ok: 33, total: 45 }, chh: { ok: 28, total: 31 }, nasal: { ok: 22, total: 24 }, przecinki: { ok: 12, total: 20 }, nie: { ok: 26, total: 30 }, "wielka litera": { ok: 18, total: 21 }, "pułapki": { ok: 9, total: 16 } } },
  modifiedAt: Date.now()
});

(async () => {
  await fetch("http://localhost:9338/json/new?http://localhost:8149/", { method: "PUT" });
  await sleep(4000);
  const list = await (await fetch("http://localhost:9338/json")).json();
  const pg = list.find(p => p.type === "page" && /localhost:8149/.test(p.url));
  if (!pg) { console.log("brak strony aplikacji"); process.exit(2); }
  const ws = new WebSocket(pg.webSocketDebuggerUrl);
  let id = 0; const P = new Map();
  ws.addEventListener("message", e => { const d = JSON.parse(e.data); if (d.id && P.has(d.id)) { P.get(d.id)(d.result || d.error); P.delete(d.id); } });
  const send = (m, p) => new Promise(r => { const i = ++id; P.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); });
  await new Promise(r => ws.onopen = r);
  await send("Page.enable"); await send("Runtime.enable");
  const ev = async (x) => { const r = await send("Runtime.evaluate", { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) return "WYJĄTEK " + JSON.stringify(r.exceptionDetails.exception).slice(0, 160); return r.result ? r.result.value : null; };
  await send("Emulation.setDeviceMetricsOverride", { width: W, height: 900, deviceScaleFactor: 2, mobile: true });

  // świeży profil przed każdym ekranem — inaczej rozegrana lekcja psuje statystyki tygodnia
  const start = async (ms) => {
    await send("Page.navigate", { url: "http://localhost:8149/" }); await sleep(1200);
    await ev(`localStorage.setItem("ortus_profile_v1", ${JSON.stringify(PROFIL)});
      localStorage.setItem("ortus_prefs_v1", JSON.stringify({level:"3-4",category:"all",theme:"all"}));`);
    // panel rodzica liczy opanowanie z postępu przy każdym wyrazie (ok >= 3), nie z profilu
    await ev(`(()=>{
      const GRUPA={"ó":"ou","u":"ou","rz":"rzz","ż":"rzz","ź":"rzz","sz":"rzz","ch":"chh","h":"chh","ą":"nasal","ę":"nasal"};
      const licz={}, post={};
      for(const w of (window.ORTUS_WORDS||[])){
        const g=GRUPA[String(w[1]||"").trim()]; if(!g) continue;
        if((w[3]||9)>4) continue;
        licz[g]=(licz[g]||0)+1; if(licz[g]>32) continue;
        const opanowany = licz[g]%7 !== 0;                 // sześć na siedem wyrazów „umie"
        post[w[0]+"|"+g] = opanowany ? {ok:3,seen:4,studied:2} : {ok:1,seen:3,studied:1};
      }
      localStorage.setItem("ortus_progress_v1", JSON.stringify(post));
      return Object.keys(post).length;})()`);
    await send("Page.navigate", { url: "http://localhost:8149/" }); await sleep(ms || 6000);
    await ev("(()=>{const s=document.createElement('style'); s.textContent='::-webkit-scrollbar{width:0!important;height:0!important;display:none!important}'; document.head.appendChild(s);})()");
    for (let i = 0; i < 3; i++) { const r = await ev(`(()=>{const b=[...document.querySelectorAll("button")].filter(e=>e.offsetParent).find(e=>/^Zaczynajmy/.test(e.textContent.trim())); if(!b)return "BRAK"; b.click(); return "ok";})()`); if (r === "BRAK") break; await sleep(700); }
    await ev("window.scrollTo(0,0)"); await sleep(500);
  };

  // kadr przycięty dokładnie do wskazanego elementu
  const shotEl = async (n, wyrazenie, opis, gora, dol) => {
    const box = await ev(`(()=>{const el=${wyrazenie}; if(!el) return null;
      const r=el.getBoundingClientRect();
      return {gora:Math.round(r.top+window.scrollY), dol:Math.round(r.bottom+window.scrollY)};})()`);
    if (!box) { console.log("   nie znaleziono: " + opis); return; }
    const y = Math.max(0, box.gora - (gora === undefined ? 20 : gora));
    const h = box.dol - y + (dol === undefined ? 20 : dol);
    const r = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y, width: W, height: h, scale: 2 } });
    fs.writeFileSync(path.join(OUT, "fb-" + n + ".png"), Buffer.from(r.data, "base64"));
    console.log("   → fb-" + n + ".png (" + opis + ", " + W + "×" + h + " css)");
  };

  const shotDwa = async (n, odWyr, doWyr, opis, gora, dol) => {
    const box = await ev(`(()=>{const a=${odWyr}, b=${doWyr}; if(!a||!b) return null;
      return {gora:Math.round(a.getBoundingClientRect().top+window.scrollY), dol:Math.round(b.getBoundingClientRect().bottom+window.scrollY)};})()`);
    if (!box) { console.log("   nie znaleziono: " + opis); return; }
    const y = Math.max(0, box.gora - gora), h = box.dol - y + dol;
    const r = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y, width: W, height: h, scale: 2 } });
    fs.writeFileSync(path.join(OUT, "fb-" + n + ".png"), Buffer.from(r.data, "base64"));
    console.log("   → fb-" + n + ".png (" + opis + ", " + W + "×" + h + " css)");
  };

  const KARTA = `[...document.querySelectorAll("div")].filter(d=>d.offsetParent&&/^rgb\\(255, 255, 255\\)$/.test(getComputedStyle(d).backgroundColor)&&d.getBoundingClientRect().height>200).sort((a,b)=>b.getBoundingClientRect().height-a.getBoundingClientRect().height)[0]`;

  // odpowiedź, która na pewno jest poprawna — szukamy wyrazu w banku po masce z „?"
  const DOBRA = `(()=>{
    const el=[...document.querySelectorAll("div")].find(d=>d.children.length===3&&d.style.wordBreak==="break-word");
    if(!el)return null;
    const pre=el.children[0].textContent, post=el.children[2].textContent;
    const opcje=[...document.querySelectorAll("button")].filter(b=>b.offsetParent&&b.style.boxShadow&&b.textContent.trim().length<=2).map(b=>b.textContent.trim());
    for(const o of opcje){ const k=(pre+o+post).toLowerCase();
      if((window.ORTUS_WORDS||[]).some(r=>String(r[0]).toLowerCase()===k)) return o; }
    return null;})()`;
  // regułka, która naprawdę coś tłumaczy — „zapamiętaj" na zrzucie nie sprzedaje pomysłu
  const REGULA_OK = `(()=>{const t=document.body.innerText; const m=/Dlaczego tak się pisze\\?\\s*\\n\\s*([^\\n]+)/.exec(t);
    if(!m) return false; const r=m[1].trim();
    return /wymienia się|→/.test(r) && !/zapamiętaj/i.test(r) && r.length<=72;})()`;

  console.log("1. ćwiczenie z regułą");
  for (let proba = 1; proba <= 6; proba++) {
    await start();
    await ev(`(()=>{const b=[...document.querySelectorAll("button")].filter(e=>e.offsetParent).find(e=>/Uzupełnij literę/.test(e.textContent)); b&&b.click();})()`);
    await sleep(3000);
    let mam = false;
    for (let i = 0; i < 16; i++) {
      const d = await ev(DOBRA);
      if (d) {
        await ev(`(()=>{const b=[...document.querySelectorAll("button")].filter(x=>x.offsetParent).find(x=>x.textContent.trim()===${JSON.stringify(d)}); b&&b.click();})()`);
        await sleep(900);
        await ev(`(()=>{const c=[...document.querySelectorAll("button,summary,a,div,span")].filter(e=>e.offsetParent&&/Dlaczego tak się pisze/.test(e.textContent));
          const el=c.reverse().find(e=>![...e.children].some(k=>/Dlaczego tak się pisze/.test(k.textContent)));
          el&&(el.closest("button,summary,a")||el).click();})()`);
        await sleep(900);
        if (await ev(REGULA_OK)) { mam = true; break; }
        await ev(`(()=>{const b=[...document.querySelectorAll("button")].filter(x=>x.offsetParent).find(x=>/^Dalej/.test(x.textContent.trim())); b&&b.click();})()`);
        await sleep(500);
      } else {
        await ev(`(()=>{const b=[...document.querySelectorAll("button")].filter(x=>x.offsetParent).find(x=>/^Dalej/.test(x.textContent.trim())); b&&b.click();})()`);
        await sleep(400);
      }
    }
    if (mam) break;
    console.log("   podejście " + proba + ": brak porządnej reguły, losuję dalej");
  }
  await ev("window.scrollTo(0,0)"); await sleep(400);
  await shotEl(1, KARTA, "reguła po dobrej odpowiedzi", 96, 24);

  console.log("2. dyktando");
  await start();
  await ev(`(()=>{const b=[...document.querySelectorAll("button")].filter(e=>e.offsetParent).find(e=>/Dyktando tekstowe/.test(e.textContent)); b&&b.click();})()`);
  await sleep(4500); await ev("window.scrollTo(0,0)"); await sleep(400);
  await shotEl(2, KARTA, "dyktando czytane na głos", 72, 6);   // tuż pod kartą stoją kolejne przyciski

  console.log("3. panel rodzica");
  await start();
  await ev(`(()=>{const b=[...document.querySelectorAll("button")].filter(e=>e.offsetParent).find(e=>e.textContent.trim()==="Pokaż"); b&&b.click();})()`);
  await sleep(1200);
  await shotDwa(3, `(()=>{const h=[...document.querySelectorAll("button")].filter(e=>e.offsetParent&&/Dla rodzica — ten tydzień/.test(e.textContent));
    return h.length? h[0] : null;})()`,
    `(()=>{const h=[...document.querySelectorAll("div")].filter(e=>e.offsetParent&&/Najsłabiej idzie/.test(e.textContent));
    return h.length? h[h.length-1] : null;})()`, "panel rodzica", 26, 26);

  console.log("4. lista ćwiczeń");
  await start();
  await shotEl(4, `(()=>{const h=[...document.querySelectorAll("h2")].filter(e=>e.offsetParent&&/Wybierz ćwiczenie/.test(e.textContent));
    return h.length? h[0].parentElement : null;})()`, "lista trybów", 30, 26);

  ws.close(); process.exit(0);
})().catch(e => { console.error("WYJĄTEK", e); process.exit(2); });
