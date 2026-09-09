// Zrzuty 1, 2 i 6 w węższym oknie — treść w ramce ma być czytelna.
const fs = require("fs"), path = require("path");
const OUT = "C:\\Users\\48607\\OneDrive\\Pulpit\\Audyt kotków\\play-grafiki\\ios";
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const R = 2166 / 990, W = 560, H = Math.round(W * R);

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

  await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 2, mobile: true });
  await ev(`localStorage.setItem("ortus_profile_v1", ${JSON.stringify(PROFIL)});
    localStorage.setItem("ortus_progress_v1", ${JSON.stringify(JSON.stringify(POSTEP))});
    localStorage.setItem("ortus_prefs_v1", JSON.stringify({level:"3-4",category:"all",theme:"all"}));`);
  await send("Page.navigate", { url: "http://localhost:8149/" }); await sleep(5500);
  for (let i = 0; i < 3; i++) { const r = await ev(`(()=>{const b=[...document.querySelectorAll("button")].filter(e=>e.offsetParent!==null).find(e=>/^Zaczynajmy/.test(e.textContent.trim())); if(!b)return "BRAK"; b.click(); return "ok";})()`); if (r === "BRAK") break; await sleep(700); }
  await ev(`(()=>{const b=[...document.querySelectorAll("button")].filter(e=>e.offsetParent!==null).find(e=>e.textContent.trim()==="Ukryj"); b&&b.click();})()`);
  await sleep(600); await ev("window.scrollTo(0,0)"); await sleep(500);

  const shotAt = async (n, re, opis, margines) => {
    const y = await ev(`(()=>{const all=[...document.querySelectorAll("div,h2,h3,span")].filter(e=>e.offsetParent!==null&&${re}.test(e.textContent));
      const el=all.reverse().find(e=>![...e.children].some(c=>${re}.test(c.textContent)));
      if(!el)return -1; return Math.max(0, Math.round(el.getBoundingClientRect().top + window.scrollY - ${margines || 24}));})()`);
    if (y < 0) { console.log("   nie znaleziono: " + opis); return; }
    const r = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y, width: W, height: H, scale: 2 } });
    fs.writeFileSync(path.join(OUT, "ios-" + n + ".png"), Buffer.from(r.data, "base64"));
    console.log("   → ios-" + n + ".png (" + opis + ", od " + y + " px)");
  };

  console.log("1. menu");
  {
    const r = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: W, height: H, scale: 2 } });
    fs.writeFileSync(path.join(OUT, "ios-1.png"), Buffer.from(r.data, "base64"));
    console.log("   → ios-1.png (góra menu)");
  }
  console.log("2. tryby");
  await shotAt(2, "/3 · Wybierz ćwiczenie i zaczynamy/", "lista trybów", 40);
  console.log("6. panel rodzica");
  await ev(`(()=>{const b=[...document.querySelectorAll("button")].filter(e=>e.offsetParent!==null).find(e=>e.textContent.trim()==="Pokaż"); b&&b.click();})()`);
  await sleep(900);
  await shotAt(6, "/Dla rodzica — ten tydzień/", "panel rodzica", 40);

  ws.close(); process.exit(0);
})().catch(e => { console.error("WYJĄTEK", e); process.exit(2); });
