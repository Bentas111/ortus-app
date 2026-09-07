// Test aplikacji w emulatorze przez Chrome DevTools Protocol (adb forward tcp:9222 → WebView).
// Emulator bez GPU nie oddaje obrazu WebView w screencap, więc zrzuty robimy z kompozytora Chromium.
const fs = require("fs"), path = require("path");
const OUT = path.join(__dirname, "test-out"); fs.mkdirSync(OUT, { recursive: true });
const fails = []; const ok = (c, m) => { console.log((c ? "  OK   " : "  FAIL ") + m); if (!c) fails.push(m); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const list = await (await fetch("http://localhost:9222/json")).json();
  const pg = list.find(p => /^https:\/\/localhost/.test(p.url));
  if (!pg) { console.log("brak strony aplikacji"); process.exit(2); }
  const ws = new WebSocket(pg.webSocketDebuggerUrl);
  let id = 0; const pending = new Map(); const dialogs = [];
  ws.addEventListener("message", e => {
    const d = JSON.parse(e.data);
    if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result || d.error); pending.delete(d.id); }
    if (d.method === "Page.javascriptDialogOpening") dialogs.push(d.params);
  });
  const send = (m, p) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); });
  await new Promise(r => ws.onopen = r);
  await send("Page.enable"); await send("Runtime.enable");
  const ev = async (x) => { const r = await send("Runtime.evaluate", { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) return "EXC: " + (r.exceptionDetails.exception || {}).description; return r.result ? r.result.value : r; };
  const shot = async (name) => { const r = await send("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(path.join(OUT, name + ".png"), Buffer.from(r.data, "base64")); console.log("zrzut:", name); };
  // klik odroczony przez setTimeout: gdy handler otworzy prompt(), evaluate zdążyło już wrócić (inaczej wisi do zamknięcia dialogu)
  const clickText = async (txt) => ev(`(()=>{const q=${JSON.stringify(txt)};const all=[...document.querySelectorAll("button,a,div,span")];const el=all.find(e=>e.tagName==="BUTTON"&&e.textContent.trim().startsWith(q))||all.find(e=>e.children.length<4&&e.textContent.trim().startsWith(q));if(!el)return "brak: "+q;setTimeout(()=>el.click(),0);return "klik: "+el.tagName+" „"+el.textContent.trim().slice(0,30)+"”";})()`);
  const text = async () => ev(`document.body.innerText.replace(/[ \\t]+/g," ").slice(0,400)`);

  console.log("\n1. start");
  await shot("10-start");
  ok((await ev("document.getElementById('dc-root').children.length")) === 1, "aplikacja wyrenderowana (dc-root ma zawartość)");
  ok((await ev("typeof window.Capacitor.Plugins.App")) === "object" && (await ev("typeof window.Capacitor.Plugins.Browser")) === "object" && (await ev("typeof window.Capacitor.Plugins.AdMob")) === "object", "wtyczki App, Browser, AdMob dostępne");
  ok((await ev("window.Capacitor.getPlatform()")) === "android", "platforma android");
  const fontOk = await ev(`document.fonts.check("800 20px 'Baloo 2'") && document.fonts.check("700 16px Nunito")`);
  ok(fontOk, "fonty Baloo 2 i Nunito załadowane z paczki");
  const pad = await ev("document.body.style.paddingBottom");
  console.log("       baner AdMob: padding-bottom =", JSON.stringify(pad), "(niepuste = baner testowy wyświetlony)");

  console.log("\n2. menu i lekcja");
  console.log("      ", await clickText("Zaczynajmy")); await sleep(800);
  await shot("11-menu");
  ok(/Wybierz ćwiczenie|Ćwiczenia z ortografii/.test(await text()), "menu widoczne");
  console.log("      ", await clickText("Pisownia „nie”")); await sleep(1000);
  await shot("12-lekcja-nie");
  const t = await text();
  ok(/Zadanie 1 z 16/.test(t) && /razem|osobno/.test(t), "lekcja „nie”: zadanie 1 z 16, przyciski razem/osobno");
  const w = await ev(`(document.body.innerText.match(/nie\\s+(\\S+)/)||[])[1]`);
  console.log("       wyraz:", w);
  console.log("      ", await clickText("razem")); await sleep(600);
  ok(/Dlaczego tak się pisze|Brawo|Ojej|Prawidłowo|osobno|razem/.test(await text()), "odpowiedź przyjęta");
  await shot("13-po-odpowiedzi");

  console.log("\n3. bramka rodzica przed linkiem zewnętrznym");
  await ev("window.__opened=[]; window.ortusOpenExternal=(u)=>window.__opened.push(u);");
  await ev(`history.back()`); await sleep(600);
  await ev(`(()=>{const a=[...document.querySelectorAll('a[href^="https://niekazmuliczyc.pl/polityka"]')][0]; if(a){setTimeout(()=>a.click(),0); return "klik";} return "brak linku";})()`);
  await sleep(800);
  ok(dialogs.length > 0 && /rodzica|opiekuna/.test(dialogs[dialogs.length - 1].message || ""), "kliknięcie linku pokazuje pytanie dla rodzica");
  if (dialogs.length) { await send("Page.handleJavaScriptDialog", { accept: true, promptText: "0" }); await sleep(300); }
  ok((await ev("window.__opened.length")) === 0, "zła odpowiedź: link nie otwiera się");
  const before = dialogs.length;
  await ev(`(()=>{const a=[...document.querySelectorAll('a[href^="https://niekazmuliczyc.pl/polityka"]')][0]; a&&setTimeout(()=>a.click(),0);})()`);
  await sleep(800);
  if (dialogs.length > before) { const m = /ile to (\d+) × (\d+)/.exec(dialogs[dialogs.length - 1].message); await send("Page.handleJavaScriptDialog", { accept: true, promptText: String(m ? m[1] * m[2] : 0) }); await sleep(300); }
  ok((await ev("window.__opened.length")) === 1 && /polityka/.test(await ev("window.__opened[0]")), "dobra odpowiedź: link otwiera się w przeglądarce systemowej");
  console.log("       dialogi:", dialogs.map(d => d.message).join(" | "), "| otwarte:", await ev("JSON.stringify(window.__opened)"));

  console.log("\n4. logowanie Google");
  await ev("window.__opened=[]");
  if (/Zaczynajmy/.test(await text())) { console.log("      ", await clickText("Zaczynajmy")); await sleep(800); }
  console.log("      ", await clickText("Zaloguj")); await sleep(1200);
  await shot("14-konto");
  ok(/rodzica lub opiekuna|Ile to/.test(await text()), "ekran konta z bramką wieku");
  const q = await ev(`(document.body.innerText.match(/Ile to (\\d+) × (\\d+)/)||[])`);
  await ev(`(()=>{const i=document.getElementById("ortus-gate"); const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set; setter.call(i, String(${q[1]}*${q[2]})); i.dispatchEvent(new Event("input",{bubbles:true})); i.dispatchEvent(new Event("change",{bubbles:true}));})()`);
  await ev(`(()=>{const b=[...document.querySelectorAll("button")].find(b=>/Sprawdź|Dalej|OK|Potwierdź/.test(b.textContent)); b&&b.click(); return b?b.textContent:"brak";})()`); await sleep(800);
  await shot("15-formularz");
  const g = await clickText("Kontynuuj z Google"); console.log("      ", g); await sleep(2500);
  const opened = await ev("JSON.stringify(window.__opened)");
  ok(/supabase\.co\/auth\/v1\/authorize.*redirect_to=pl\.niekazmuliczyc\.ortus/.test(opened), "Google: otwiera przeglądarkę systemową z adresem powrotu pl.niekazmuliczyc.ortus://auth");
  console.log("       url:", (JSON.parse(opened)[0] || "").slice(0, 120));

  console.log("\n5. ikona: foreground w bezpiecznej strefie");
  const href = await ev(`document.querySelector('link[rel="icon"]').getAttribute('href')`);
  const png = await ev(`(async()=>{const svg=decodeURIComponent(${JSON.stringify(href)}.replace(/^data:image\\/svg\\+xml,/,''));const img=new Image();await new Promise((r,j)=>{img.onload=r;img.onerror=j;img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);});const c=document.createElement('canvas');c.width=c.height=1024;const x=c.getContext('2d');x.fillStyle='#6C4BD6';x.fillRect(0,0,1024,1024);const h=1024*0.42,w=h*100/112;x.drawImage(img,(1024-w)/2,(1024-h)/2,w,h);return c.toDataURL('image/png');})()`);
  fs.writeFileSync(path.join(__dirname, "assets", "icon-foreground.png"), Buffer.from(png.replace(/^data:image\/png;base64,/, ""), "base64"));
  console.log("       zapisano assets/icon-foreground.png (duszek 42% wysokości)");

  console.log("\n" + (fails.length ? "BŁĘDÓW: " + fails.length : "WSZYSTKO OK"));
  ws.close(); process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error("WYJĄTEK", e); process.exit(2); });
