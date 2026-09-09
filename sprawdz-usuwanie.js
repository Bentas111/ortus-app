// Sprawdza, czy strona wstaje bez błędów i czy przycisk „Usuń konto” pojawia się po zalogowaniu.
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  await fetch("http://localhost:9338/json/new?http://localhost:8149/", { method: "PUT" });
  await sleep(4000);
  const list = await (await fetch("http://localhost:9338/json")).json();
  const pg = list.find(p => p.type === "page" && /localhost:8149/.test(p.url));
  if (!pg) { console.log("brak strony"); process.exit(2); }
  const ws = new WebSocket(pg.webSocketDebuggerUrl);
  let id = 0; const P = new Map(); const bledy = [];
  ws.addEventListener("message", e => {
    const d = JSON.parse(e.data);
    if (d.method === "Runtime.exceptionThrown") bledy.push((d.params.exceptionDetails.exception || {}).description || d.params.exceptionDetails.text);
    if (d.method === "Runtime.consoleAPICalled" && d.params.type === "error") bledy.push(d.params.args.map(a => a.value || a.description).join(" "));
    if (d.id && P.has(d.id)) { P.get(d.id)(d.result || d.error); P.delete(d.id); }
  });
  const send = (m, p) => new Promise(r => { const i = ++id; P.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); });
  await new Promise(r => ws.onopen = r);
  await send("Page.enable"); await send("Runtime.enable");
  const ev = async (x) => { const r = await send("Runtime.evaluate", { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) return "EXC " + JSON.stringify(r.exceptionDetails.exception).slice(0, 200); return r.result ? r.result.value : r; };

  await send("Page.navigate", { url: "http://localhost:8149/" }); await sleep(6000);
  await ev(`(()=>{const b=[...document.querySelectorAll("button")].find(e=>/^Zaczynajmy/.test(e.textContent.trim())); b&&b.click();})()`);
  await sleep(1200);
  console.log("menu wstało:", await ev(`/Wybierz ćwiczenie/.test(document.body.innerText)`));
  console.log("przycisk bez logowania:", await ev(`[...document.querySelectorAll("button")].some(b=>b.textContent.trim()==="Usuń konto")`));

  // udajemy zalogowanego: podstawiamy usera do komponentu
  console.log("po zalogowaniu:", await ev(`(()=>{
    const k=Object.keys(window).find(x=>/^__dc/.test(x));
    const root=document.querySelector("#dc-root")||document.body;
    const inst=(function find(n){ for(const key in n){ if(key.startsWith("__reactFiber$")||key.startsWith("__reactInternalInstance$")){ let f=n[key]; while(f){ if(f.stateNode && f.stateNode.setState && f.stateNode.deleteAccount) return f.stateNode; f=f.return; } } } return null;})(root.firstElementChild||root);
    if(!inst) return "nie znalazłem komponentu";
    inst.setState({user:{id:"test-1234", email:"test@example.com"}});
    return new Promise(r=>setTimeout(()=>r([...document.querySelectorAll("button")].some(b=>b.textContent.trim()==="Usuń konto")?"przycisk jest":"przycisku brak"),900));
  })()`));
  console.log("metoda istnieje:", await ev(`(()=>{const root=document.querySelector("#dc-root")||document.body; const n=root.firstElementChild||root; for(const key in n){ if(key.startsWith("__reactFiber$")){ let f=n[key]; while(f){ if(f.stateNode&&f.stateNode.deleteAccount) return typeof f.stateNode.deleteAccount; f=f.return; } } } return "brak";})()`));
  console.log("błędy:", bledy.length ? bledy.slice(0, 5) : "brak");
  ws.close(); process.exit(0);
})().catch(e => { console.error("WYJĄTEK", e); process.exit(2); });
