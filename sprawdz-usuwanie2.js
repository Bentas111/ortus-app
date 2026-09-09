// Podstawiamy fałszywą sesję Supabase w localStorage i sprawdzamy, czy menu pokazuje „Usuń konto”.
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const list = await (await fetch("http://localhost:9338/json")).json();
  const pg = list.find(p => p.type === "page" && /localhost:8149/.test(p.url));
  if (!pg) { console.log("brak strony"); process.exit(2); }
  const ws = new WebSocket(pg.webSocketDebuggerUrl);
  let id = 0; const P = new Map(); const bledy = [];
  ws.addEventListener("message", e => {
    const d = JSON.parse(e.data);
    if (d.method === "Runtime.exceptionThrown") bledy.push(((d.params.exceptionDetails.exception || {}).description || d.params.exceptionDetails.text || "").slice(0, 160));
    if (d.id && P.has(d.id)) { P.get(d.id)(d.result || d.error); P.delete(d.id); }
  });
  const send = (m, p) => new Promise(r => { const i = ++id; P.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); });
  await new Promise(r => ws.onopen = r);
  await send("Page.enable"); await send("Runtime.enable");
  const ev = async (x) => { const r = await send("Runtime.evaluate", { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) return "EXC " + JSON.stringify(r.exceptionDetails.exception).slice(0, 200); return r.result ? r.result.value : r; };

  // token JWT bez podpisu — supabase-js czyta go lokalnie, nam wystarczy, że sesja „jest”
  const nag = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const tresc = Buffer.from(JSON.stringify({ sub: "11111111-2222-3333-4444-555555555555", email: "test@example.com", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600, aud: "authenticated" })).toString("base64url");
  const jwt = nag + "." + tresc + ".xxxx";
  const sesja = JSON.stringify({ access_token: jwt, token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "r-test",
    user: { id: "11111111-2222-3333-4444-555555555555", aud: "authenticated", role: "authenticated", email: "test@example.com", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } });

  const klucz = await ev(`(()=>{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i); if(/^sb-.*-auth-token$/.test(k)) return k;} return "sb-ngaifkbatovxhysbprmn-auth-token";})()`);
  await ev(`localStorage.setItem(${JSON.stringify(klucz)}, ${JSON.stringify(sesja)}); "ok"`);
  await send("Page.navigate", { url: "http://localhost:8149/" }); await sleep(7000);
  await ev(`(()=>{const b=[...document.querySelectorAll("button")].find(e=>/^Zaczynajmy/.test(e.textContent.trim())); b&&b.click();})()`);
  await sleep(1500);

  console.log("klucz sesji:", klucz);
  console.log("przyciski konta:", await ev(`[...document.querySelectorAll("button")].map(b=>b.textContent.trim()).filter(t=>/Wyloguj|Usuń konto|Zaloguj się/.test(t))`));
  console.log("gdzie stoi:", await ev(`(()=>{const b=[...document.querySelectorAll("button")].find(x=>x.textContent.trim()==="Usuń konto"); if(!b)return "brak"; const r=b.getBoundingClientRect(); const st=getComputedStyle(b); return {y:Math.round(r.top+window.scrollY), wysokoscStrony:document.body.scrollHeight, font:st.fontSize, wStopce:!!b.closest("div")&&/Pisownia według|Strona główna/.test((b.closest("div").parentElement||{}).innerText||"")};})()`));
  console.log("błędy:", bledy.length ? bledy.slice(0, 4) : "brak");
  ws.close(); process.exit(0);
})().catch(e => { console.error("WYJĄTEK", e); process.exit(2); });
