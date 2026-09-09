// Druga tura: okna (ranking, odznaki, moje słowa), panel rodzica, wynik lekcji, tryb czytelności.
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

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

  const SPRAWDZ = `(()=>{
    const w = document.documentElement.clientWidth;
    const nadmiar = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - w;
    const out = [];
    document.querySelectorAll("body *").forEach(e=>{
      const r = e.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      const prawa = r.right + window.scrollX, lewa = r.left + window.scrollX;
      if (prawa > w + 1 || lewa < -1) {
        if ([...e.children].some(c=>{const cr=c.getBoundingClientRect(); return cr.right+window.scrollX>w+1 || cr.left+window.scrollX<-1;})) return;
        out.push(e.tagName.toLowerCase() + " [" + Math.round(lewa) + "→" + Math.round(prawa) + "] „" + (e.textContent||"").replace(/\\s+/g," ").trim().slice(0,40) + "” " + (e.getAttribute("style")||"").slice(0,80));
      }
    });
    return {nadmiar, lista: out.slice(0,5)};
  })()`;
  const klik = (tekst) => ev(`(()=>{const b=[...document.querySelectorAll("button,a")].filter(e=>e.offsetParent!==null).find(e=>e.textContent.trim().startsWith(${JSON.stringify(tekst)})); if(!b)return "BRAK"; b.click(); return "ok";})()`);
  const raport = async (nazwa) => { const r = await ev(SPRAWDZ); if (r && r.nadmiar > 0) { console.log("  " + nazwa + " — wystaje o " + r.nadmiar + " px"); (r.lista||[]).forEach(x=>console.log("      " + x)); } else console.log("  " + nazwa + " — ok"); };

  const PROFIL = JSON.stringify({ xp:5605, streak:12, lessons:31, dictations:4, perfect:9, entered:true, guest:true, onboarded:true,
    badges:{start:1,first:1,streak3:1,streak7:1,xp500:1,xp2500:1,coll25:1,coll100:1,perfect1:1,perfect5:1,mode3:1,dict1:1},
    modes:{fill:1,choose:1,nie:1,case:1,comma:1,trap:1,textdict:1,study:1},
    todayDay:"2026-9-9", todayXp:180, lastDay:"2026-9-9", weekKey:"2026-W37", weekXp:1240,
    week:{key:"2026-W37", xp:1240, lessons:7, dictations:2, words:{ok:34,total:41},
      skills:{ou:{ok:41,total:46}, rzz:{ok:33,total:45}, chh:{ok:28,total:31}, nasal:{ok:22,total:24}, przecinki:{ok:12,total:20}, nie:{ok:26,total:30}, "wielka litera":{ok:18,total:21}, "pułapki":{ok:9,total:16}}},
    modifiedAt: Date.now() });
  const POSTEP = {}; ["morze|rzz","żółw|rzz","góra|ou","chmura|chh","wąż|nasal","rzeka|rzz","król|ou","chleb|chh"].forEach(k=>POSTEP[k]={ok:3,seen:4,studied:2});

  for (const w of [320, 390]) {
    console.log("\n=== szerokość " + w + " px ===");
    await send("Emulation.setDeviceMetricsOverride", { width: w, height: 820, deviceScaleFactor: 2, mobile: true });
    await ev(`localStorage.setItem("ortus_profile_v1", ${JSON.stringify(PROFIL)}); localStorage.setItem("ortus_progress_v1", ${JSON.stringify(JSON.stringify(POSTEP))}); "ok"`);
    await send("Page.navigate", { url: "http://localhost:8149/" }); await sleep(5500);
    await klik("Zaczynajmy"); await sleep(1000);
    await raport("menu");

    await klik("Pokaż"); await sleep(900); await raport("panel rodzica");
    await klik("Ukryj"); await sleep(500);

    for (const [nazwa, etykieta] of [["odznaki","🏅 Odznaki"], ["moje słowa","Moje słowa"], ["ranking","🏆 Ranking"]]) {
      const r = await klik(etykieta);
      if (r === "BRAK") { console.log("  " + nazwa + " — nie znalazłem przycisku"); continue; }
      await sleep(1600); await raport(nazwa);
      await ev(`(()=>{const b=[...document.querySelectorAll("button")].filter(e=>e.offsetParent!==null).find(e=>/^(Zamknij|Wróć|×|✕)/.test(e.textContent.trim())); b&&b.click();})()`);
      await sleep(700);
    }

    // tryb większej czytelności
    await ev(`(()=>{const el=[...document.querySelectorAll("input[type=checkbox],[role=switch],button")].filter(e=>e.offsetParent!==null); const t=[...document.querySelectorAll("*")].find(e=>e.children.length===0&&/Tryb większej czytelności/.test(e.textContent)); if(!t)return "BRAK"; const row=t.closest("div"); const sw=row&&row.parentElement&&row.parentElement.querySelector("input,[role=switch],button"); sw&&sw.click(); return "ok";})()`);
    await sleep(1200); await raport("menu w trybie czytelności");

    await send("Page.navigate", { url: "http://localhost:8149/?tryb=slowka&klasa=3" }); await sleep(5000);
    await klik("Zaczynajmy"); await sleep(800); await raport("nauka słówek");

    await send("Page.navigate", { url: "http://localhost:8149/?tryb=blad&klasa=5" }); await sleep(5000);
    await klik("Zaczynajmy"); await sleep(800); await raport("znajdź błąd (klasa 5)");
  }
  ws.close(); process.exit(0);
})().catch(e => { console.error("WYJĄTEK", e); process.exit(2); });
