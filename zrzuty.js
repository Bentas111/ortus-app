// Zrzuty ekranu do Google Play: 6 stanów aplikacji, przez Chrome DevTools Protocol (Chrome headless, port 9333).
// Zapisuje play-grafiki/zrzut-N.png w rozmiarze 900×1430 — dokładnie tyle, ile ma biała ramka w szablonie.
const fs = require("fs"), path = require("path");
const OUT = "C:\\Users\\48607\\OneDrive\\Pulpit\\Audyt kotków\\play-grafiki";
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const list = await (await fetch("http://localhost:9333/json")).json();
  const pg = list.find(p => p.type === "page" && /localhost:8149/.test(p.url));
  if (!pg) { console.log("brak strony aplikacji"); process.exit(2); }
  const ws = new WebSocket(pg.webSocketDebuggerUrl);
  let id = 0; const pending = new Map();
  ws.addEventListener("message", e => { const d = JSON.parse(e.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result || d.error); pending.delete(d.id); } });
  const send = (m, p) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); });
  await new Promise(r => ws.onopen = r);
  await send("Page.enable"); await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 900, height: 1430, deviceScaleFactor: 1, mobile: true });
  const ev = async (x) => { const r = await send("Runtime.evaluate", { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) return "EXC " + JSON.stringify(r.exceptionDetails.exception).slice(0, 120); return r.result ? r.result.value : r; };
  const shot = async (n, opis) => { const r = await send("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(path.join(OUT, "zrzut-" + n + ".png"), Buffer.from(r.data, "base64")); console.log("   → zrzut-" + n + ".png (" + opis + ")"); };
  // ekrany z krótką treścią kadrujemy ciasno, żeby w szablonie nie było pustego pola
  const dopasujKadr = async () => {
    // najniższy widoczny element treści (wrapper ma min-height:100vh, więc go pomijamy)
    const h = await ev(`(()=>{let b=0;[...document.querySelectorAll("#dc-root div,#dc-root button")].forEach(e=>{const r=e.getBoundingClientRect(); if(r.height>0&&r.height<900&&r.bottom>b)b=r.bottom;}); return Math.min(1430, Math.max(760, Math.ceil(b)+56));})()`);
    await send("Emulation.setDeviceMetricsOverride", { width: 900, height: h, deviceScaleFactor: 1, mobile: true });
    await sleep(500); return h;
  };
  const pelnyKadr = async () => send("Emulation.setDeviceMetricsOverride", { width: 900, height: 1430, deviceScaleFactor: 1, mobile: true });
  const txt = async (n) => ev(`document.body.innerText.replace(/\\s+/g," ").slice(0,${n || 100})`);
  // klik po treści; zwraca co kliknięto albo BRAK
  const click = async (q, opts) => {
    const only = (opts && opts.tag) || "button,a,div,span";
    const exact = !!(opts && opts.exact);
    return ev(`(()=>{const q=${JSON.stringify(q)};const all=[...document.querySelectorAll(${JSON.stringify(only)})].filter(e=>e.offsetParent!==null);
      const m=(e)=>{const t=e.textContent.trim(); return ${exact} ? t===q : t.startsWith(q);};
      const el=all.find(e=>e.tagName==="BUTTON"&&m(e))||all.find(e=>e.children.length<5&&m(e));
      if(!el)return "BRAK "+q; el.click(); return el.textContent.trim().slice(0,28);})()`);
  };
  // zamiast przewijania: wycinamy z pełnej strony prostokąt 900×1430 zaczynający się na danym elemencie
  const shotAt = async (n, re, opis, margines) => {
    // bierzemy najgłębszy element z tym tekstem, żeby nie trafić w kontener całej strony
    const y = await ev(`(()=>{const all=[...document.querySelectorAll("div,h2,h3,span")].filter(e=>e.offsetParent!==null&&${re}.test(e.textContent));
      const el=all.reverse().find(e=>![...e.children].some(c=>${re}.test(c.textContent)));
      if(!el)return -1; return Math.max(0, Math.round(el.getBoundingClientRect().top + window.scrollY - ${margines || 24}));})()`);
    if (y < 0) { console.log("   nie znaleziono sekcji"); return; }
    const r = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y, width: 900, height: 1430, scale: 1 } });
    fs.writeFileSync(path.join(OUT, "zrzut-" + n + ".png"), Buffer.from(r.data, "base64"));
    console.log("   → zrzut-" + n + ".png (" + opis + ", od " + y + " px)");
  };

  const PROFIL = JSON.stringify({
    xp: 5605, streak: 12, lessons: 31, dictations: 4, perfect: 9, bestCombo: 14, goals: 8, exams: 2, topGrade: 5,
    entered: true, guest: true, onboarded: true, showIntro: false,
    badges: { start: 1, first: 1, streak3: 1, streak7: 1, xp500: 1, xp2500: 1, coll25: 1, coll100: 1, perfect1: 1, perfect5: 1, mode3: 1, dict1: 1 },
    modes: { fill: 1, choose: 1, nie: 1, case: 1, comma: 1, trap: 1, textdict: 1, study: 1 },
    todayDay: "2026-9-7", todayXp: 180, lastDay: "2026-9-7", weekKey: "2026-W37", weekXp: 1240,
    week: { key: "2026-W37", xp: 1240, lessons: 7, dictations: 2, words: { ok: 34, total: 41 },
      skills: { ou: { ok: 41, total: 46 }, rzz: { ok: 33, total: 45 }, chh: { ok: 28, total: 31 }, nasal: { ok: 22, total: 24 }, przecinki: { ok: 12, total: 20 }, nie: { ok: 26, total: 30 }, "wielka litera": { ok: 18, total: 21 }, "pułapki": { ok: 9, total: 16 } } },
    modifiedAt: Date.now()
  });
  const POSTEP = {}; ["morze|rzz", "żółw|rzz", "góra|ou", "chmura|chhh", "wąż|nasal", "rzeka|rzz", "król|ou", "chleb|chh"].forEach(k => POSTEP[k] = { ok: 3, seen: 4, studied: 2 });

  const doMenu = async () => {
    await ev(`localStorage.setItem("ortus_profile_v1", ${JSON.stringify(PROFIL)});
      localStorage.setItem("ortus_progress_v1", ${JSON.stringify(JSON.stringify(POSTEP))});
      localStorage.setItem("ortus_prefs_v1", JSON.stringify({level:"3-4",category:"all",theme:"all"}));`);
    await send("Page.navigate", { url: "http://localhost:8149/" }); await sleep(5000);
    // ekran powitalny zasłania menu — zamykamy
    for (let i = 0; i < 3; i++) { const r = await click("Zaczynajmy"); if (/^BRAK/.test(r)) break; await sleep(700); }
    await ev("window.scrollTo(0,0)"); await sleep(500);
  };

  // poprawną odpowiedź wyliczamy z banku: "niedobry" jest w bazie łącznie, "nie wolno" ze spacją
  const POPRAWNA = `(()=>{const t=document.body.innerText;
    const m=/Jak zapiszemy to wyrażenie\\?\\s*\\n\\s*nie\\s+([^\\n]+)/.exec(t)||/\\bnie\\s+([a-ząćęłńóśźż]+)\\s*\\n/i.exec(t);
    if(!m)return null; const w=m[1].trim().toLowerCase();
    const B=(window.ORTUS_WORDS||[]).filter(r=>(r[1]||"").split(",").map(s=>s.trim()).includes("nie"));
    if(B.some(r=>r[0].toLowerCase()==="nie"+w))return "razem";
    if(B.some(r=>r[0].toLowerCase()==="nie "+w))return "osobno";
    return null;})()`;

  console.log("1. menu");
  await doMenu();
  console.log("   panel rodzica zwijam:", await click("Ukryj", { exact: true }));   // żeby zrzut 1 nie dublował zrzutu 6
  await sleep(700); await ev("window.scrollTo(0,0)"); await sleep(400);
  console.log("   " + await txt(80));
  await shot(1, "menu: passa, XP, cel dzienny");

  console.log("2. kafelki trybów");
  await shotAt(2, "/WYBIERZ KLASĘ/", "klasa, temat i tryby");

  // tryby otwieramy adresem (aplikacja obsługuje ?tryb=...), klikanie w kafelki trafiało w wiersze statystyk
  const tryb = async (t, ms) => { await send("Page.navigate", { url: "http://localhost:8149/?tryb=" + t + "&klasa=3" }); await sleep(ms || 5000); for (let i = 0; i < 2; i++) { const r = await click("Zaczynajmy"); if (/^BRAK/.test(r)) break; await sleep(600); } await ev("window.scrollTo(0,0)"); await sleep(500); };

  console.log("3. dyktando czytane na głos");
  await tryb("dyktando", 7000);
  console.log("   " + await txt(80));
  console.log("   kadr:", await dopasujKadr(), "px");
  await shot(3, "dyktando");
  await pelnyKadr();

  console.log("4. reguła po odpowiedzi");
  await tryb("nie");
  console.log("   odpowiedź:", await ev(`(()=>{const dobra=${POPRAWNA}; const b=[...document.querySelectorAll("button")].filter(b=>b.offsetParent!==null); const el=b.find(x=>x.textContent.trim()===dobra)||b.find(x=>/^(razem|osobno)$/.test(x.textContent.trim())); if(!el)return "BRAK"; el.click(); return el.textContent.trim();})()`));
  await sleep(1200);
  console.log("   reguła:", await ev(`(()=>{const el=[...document.querySelectorAll("button,a,div,span")].filter(e=>e.offsetParent!==null).find(e=>e.children.length<3&&/Dlaczego tak się pisze/.test(e.textContent)); if(!el)return "BRAK"; el.click(); return "rozwinięte";})()`));
  await sleep(900); await ev("window.scrollTo(0,0)"); await sleep(500);
  console.log("   " + await txt(90));
  console.log("   kadr:", await dopasujKadr(), "px");
  await shot(4, "wyjaśnienie reguły");
  await pelnyKadr();

  console.log("5. podsumowanie lekcji");
  // odpowiadamy poprawnie — stan lekcji czytamy z instancji komponentu (React fiber), żeby wynik na zrzucie był prawdziwy

  for (let i = 0; i < 40; i++) {
    const r = await ev(`(()=>{const vis=[...document.querySelectorAll("button")].filter(b=>b.offsetParent!==null);
      const next=vis.find(b=>/^(Dalej|Następne|Zobacz wynik|Kolejne)/i.test(b.textContent.trim()));
      if(next){next.click(); return "dalej";}
      const dobra=${POPRAWNA};
      const ans=vis.find(b=>b.textContent.trim()===dobra)||vis.find(b=>/^(razem|osobno)$/.test(b.textContent.trim()));
      if(ans){ans.click(); return "odp:"+ans.textContent.trim();}
      return "koniec";})()`);
    if (r === "koniec") break;
    await sleep(400);
  }
  await sleep(2000); await ev("window.scrollTo(0,0)"); await sleep(500);
  console.log("   " + await txt(90));
  await shot(5, "podsumowanie");

  console.log("6. panel rodzica");
  await doMenu();
  await shotAt(6, "/Dla rodzica — ten tydzień/", "panel rodzica", 40);

  console.log("\ngotowe:", OUT);
  ws.close(); process.exit(0);
})().catch(e => { console.error("WYJĄTEK", e); process.exit(2); });
