// Zrzuty do App Store: sześć stanów aplikacji w proporcji wnętrza ramki z szablonu (990 × 2166).
// Krótkie ekrany łapiemy w węższym oknie, żeby po przeskalowaniu treść była większa.
const fs = require("fs"), path = require("path");
const OUT = "C:\\Users\\48607\\OneDrive\\Pulpit\\Audyt kotków\\play-grafiki\\ios";
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const PROPORCJA = 2166 / 990;   // wysokość / szerokość wnętrza ramki

(async () => {
  const list = await (await fetch("http://localhost:9338/json")).json();
  let pg = list.find(p => p.type === "page" && /localhost:8149/.test(p.url));
  if (!pg) {
    await fetch("http://localhost:9338/json/new?http://localhost:8149/?klasa=3", { method: "PUT" });
    await sleep(4000);
    const l2 = await (await fetch("http://localhost:9338/json")).json();
    pg = l2.find(p => p.type === "page" && /localhost:8149/.test(p.url));
  }
  if (!pg) { console.log("brak strony aplikacji"); process.exit(2); }

  const ws = new WebSocket(pg.webSocketDebuggerUrl);
  let id = 0; const P = new Map();
  ws.addEventListener("message", e => { const d = JSON.parse(e.data); if (d.id && P.has(d.id)) { P.get(d.id)(d.result || d.error); P.delete(d.id); } });
  const send = (m, p) => new Promise(r => { const i = ++id; P.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); });
  await new Promise(r => ws.onopen = r);
  await send("Page.enable"); await send("Runtime.enable");
  const ev = async (x) => { const r = await send("Runtime.evaluate", { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) return "EXC " + JSON.stringify(r.exceptionDetails.exception).slice(0, 120); return r.result ? r.result.value : r; };
  const okno = async (w) => { await send("Emulation.setDeviceMetricsOverride", { width: w, height: Math.round(w * PROPORCJA), deviceScaleFactor: 1, mobile: true }); await sleep(600); };
  // krótkie ekrany: kadr do wysokości treści, żeby w ramce nie zostawało puste pole
  const kadrTresci = async (w) => {
    const h = await ev(`(()=>{let b=0;[...document.querySelectorAll("#dc-root div,#dc-root button")].forEach(e=>{const r=e.getBoundingClientRect(); if(r.height>0&&r.height<900&&r.bottom>b)b=r.bottom;}); return Math.max(500, Math.ceil(b)+40);})()`);
    await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: true });
    await sleep(500); return h;
  };
  const shot = async (n, opis) => { const r = await send("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(path.join(OUT, "ios-" + n + ".png"), Buffer.from(r.data, "base64")); console.log("   → ios-" + n + ".png (" + opis + ")"); };
  const shotAt = async (n, re, opis, w, margines) => {
    await okno(w);
    const y = await ev(`(()=>{const all=[...document.querySelectorAll("div,h2,h3,span")].filter(e=>e.offsetParent!==null&&${re}.test(e.textContent));
      const el=all.reverse().find(e=>![...e.children].some(c=>${re}.test(c.textContent)));
      if(!el)return -1; return Math.max(0, Math.round(el.getBoundingClientRect().top + window.scrollY - ${margines || 24}));})()`);
    if (y < 0) { console.log("   nie znaleziono sekcji"); return; }
    const r = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y, width: w, height: Math.round(w * PROPORCJA), scale: 1 } });
    fs.writeFileSync(path.join(OUT, "ios-" + n + ".png"), Buffer.from(r.data, "base64"));
    console.log("   → ios-" + n + ".png (" + opis + ", od " + y + " px)");
  };
  const click = async (q, opts) => {
    const only = (opts && opts.tag) || "button,a,div,span";
    const exact = !!(opts && opts.exact);
    return ev(`(()=>{const q=${JSON.stringify(q)};const all=[...document.querySelectorAll(${JSON.stringify(only)})].filter(e=>e.offsetParent!==null);
      const m=(e)=>{const t=e.textContent.trim(); return ${exact} ? t===q : t.startsWith(q);};
      const el=all.find(e=>e.tagName==="BUTTON"&&m(e))||all.find(e=>e.children.length<5&&m(e));
      if(!el)return "BRAK "+q; el.click(); return el.textContent.trim().slice(0,24);})()`);
  };

  const PROFIL = JSON.stringify({
    xp: 5605, streak: 12, lessons: 31, dictations: 4, perfect: 9, bestCombo: 14, goals: 8, exams: 2, topGrade: 5,
    entered: true, guest: true, onboarded: true,
    badges: { start: 1, first: 1, streak3: 1, streak7: 1, xp500: 1, xp2500: 1, coll25: 1, coll100: 1, perfect1: 1, perfect5: 1, mode3: 1, dict1: 1 },
    modes: { fill: 1, choose: 1, nie: 1, case: 1, comma: 1, trap: 1, textdict: 1, study: 1 },
    todayDay: "2026-9-8", todayXp: 180, lastDay: "2026-9-8", weekKey: "2026-W37", weekXp: 1240,
    week: { key: "2026-W37", xp: 1240, lessons: 7, dictations: 2, words: { ok: 34, total: 41 },
      skills: { ou: { ok: 41, total: 46 }, rzz: { ok: 33, total: 45 }, chh: { ok: 28, total: 31 }, nasal: { ok: 22, total: 24 }, przecinki: { ok: 12, total: 20 }, nie: { ok: 26, total: 30 }, "wielka litera": { ok: 18, total: 21 }, "pułapki": { ok: 9, total: 16 } } },
    modifiedAt: Date.now()
  });
  const POSTEP = {}; ["morze|rzz", "żółw|rzz", "góra|ou", "chmura|chh", "wąż|nasal", "rzeka|rzz", "król|ou", "chleb|chh"].forEach(k => POSTEP[k] = { ok: 3, seen: 4, studied: 2 });

  const doMenu = async (w) => {
    await okno(w);
    await ev(`localStorage.setItem("ortus_profile_v1", ${JSON.stringify(PROFIL)});
      localStorage.setItem("ortus_progress_v1", ${JSON.stringify(JSON.stringify(POSTEP))});
      localStorage.setItem("ortus_prefs_v1", JSON.stringify({level:"3-4",category:"all",theme:"all"}));`);
    await send("Page.navigate", { url: "http://localhost:8149/" }); await sleep(5000);
    for (let i = 0; i < 3; i++) { const r = await click("Zaczynajmy"); if (/^BRAK/.test(r)) break; await sleep(700); }
    await ev("window.scrollTo(0,0)"); await sleep(500);
  };
  const tryb = async (t, w, ms) => {
    await okno(w);
    await send("Page.navigate", { url: "http://localhost:8149/?tryb=" + t + "&klasa=3" }); await sleep(ms || 5000);
    for (let i = 0; i < 2; i++) { const r = await click("Zaczynajmy"); if (/^BRAK/.test(r)) break; await sleep(600); }
    await ev("window.scrollTo(0,0)"); await sleep(500);
  };
  const POPRAWNA = `(()=>{const t=document.body.innerText;
    const m=/Jak zapiszemy to wyrażenie\\?\\s*\\n\\s*nie\\s+([^\\n]+)/.exec(t)||/\\bnie\\s+([a-ząćęłńóśźż]+)\\s*\\n/i.exec(t);
    if(!m)return null; const w=m[1].trim().toLowerCase();
    const B=(window.ORTUS_WORDS||[]).filter(r=>(r[1]||"").split(",").map(s=>s.trim()).includes("nie"));
    if(B.some(r=>r[0].toLowerCase()==="nie"+w))return "razem";
    if(B.some(r=>r[0].toLowerCase()==="nie "+w))return "osobno";
    return null;})()`;

  console.log("1. menu");
  await doMenu(990);
  await click("Ukryj", { exact: true }); await sleep(700); await ev("window.scrollTo(0,0)"); await sleep(400);
  await shot(1, "menu");

  console.log("2. tryby");
  await shotAt(2, "/WYBIERZ KLASĘ/", "klasa i tryby", 990);

  console.log("3. dyktando");
  await tryb("dyktando", 700, 7000);
  console.log("   kadr:", await kadrTresci(700), "px");
  await shot(3, "dyktando");

  console.log("4. reguła");
  await tryb("nie", 700);
  // przewijamy do pytania, którego poprawną odpowiedź da się ustalić z bazy (bank ręczny jej nie ma)
  for (let i = 0; i < 16; i++) {
    const dobra = await ev(POPRAWNA);
    if (dobra) { console.log("   odpowiedź:", await ev(`(()=>{const b=[...document.querySelectorAll("button")].filter(x=>x.offsetParent!==null).find(x=>x.textContent.trim()===${JSON.stringify(dobra)}); if(!b)return "BRAK"; b.click(); return b.textContent.trim();})()`)); break; }
    await ev(`(()=>{const b=[...document.querySelectorAll("button")].filter(x=>x.offsetParent!==null); const a=b.find(x=>/^(razem|osobno)$/.test(x.textContent.trim())); a&&a.click();})()`);
    await sleep(500);
    await ev(`(()=>{const b=[...document.querySelectorAll("button")].filter(x=>x.offsetParent!==null).find(x=>/^Dalej/.test(x.textContent.trim())); b&&b.click();})()`);
    await sleep(500);
  }
  await sleep(1200);
  await ev(`(()=>{const el=[...document.querySelectorAll("button,a,div,span")].filter(e=>e.offsetParent!==null).find(e=>e.children.length<3&&/Dlaczego tak się pisze/.test(e.textContent)); el&&el.click();})()`);
  await sleep(900); await ev("window.scrollTo(0,0)"); await sleep(400);
  console.log("   kadr:", await kadrTresci(700), "px");
  await shot(4, "reguła po odpowiedzi");

  console.log("5. podsumowanie");
  for (let i = 0; i < 40; i++) {
    const r = await ev(`(()=>{const vis=[...document.querySelectorAll("button")].filter(b=>b.offsetParent!==null);
      const next=vis.find(b=>/^(Dalej|Następne|Zobacz wynik|Kolejne)/i.test(b.textContent.trim()));
      if(next){next.click(); return "dalej";}
      const dobra=${POPRAWNA};
      const ans=vis.find(x=>x.textContent.trim()===dobra)||vis.find(x=>/^(razem|osobno)$/.test(x.textContent.trim()));
      if(ans){ans.click(); return "odp";}
      return "koniec";})()`);
    if (r === "koniec") break;
    await sleep(380);
  }
  await sleep(1800); await okno(990); await ev("window.scrollTo(0,0)"); await sleep(500);
  console.log("   " + await ev(`document.body.innerText.replace(/\\s+/g," ").slice(0,70)`));
  await shot(5, "podsumowanie");

  console.log("6. panel rodzica");
  await doMenu(990);
  await shotAt(6, "/Dla rodzica — ten tydzień/", "panel rodzica", 990, 40);

  console.log("\ngotowe:", OUT);
  ws.close(); process.exit(0);
})().catch(e => { console.error("WYJĄTEK", e); process.exit(2); });
