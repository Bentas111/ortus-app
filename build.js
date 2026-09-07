// Buduje www/ dla aplikacji mobilnej z paczki webowej (_pakiet/ortografia).
// Uruchom: node build.js  → potem: npx cap sync
const fs = require("fs"), path = require("path");
// źródło gry: paczka webowa (na OneDrive); projekt aplikacji leży poza OneDrive, bo Gradle nie znosi „ó" w ścieżce
const SRC = [path.join(__dirname, "..", "_pakiet", "ortografia"), "C:\\Users\\48607\\OneDrive\\Pulpit\\Audyt kotków\\_pakiet\\ortografia"].find(p => fs.existsSync(p));
const WWW = path.join(__dirname, "www");
const cp = (f) => fs.copyFileSync(path.join(SRC, f), path.join(WWW, f));
["wordbank.js", "dyktanda.js", "support.js", "supabase-config.js"].forEach(cp);
fs.copyFileSync(path.join(__dirname, "app-native.js"), path.join(WWW, "app-native.js"));

let s = fs.readFileSync(path.join(SRC, "index.html"), "utf8");
let n = 0;
function rep(re, to, label, count = 1) {
  const m = s.match(re instanceof RegExp ? re : new RegExp(re.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"));
  const c = m ? m.length : 0;
  if (c !== count) { console.error("ANCHOR FAIL:", label, c, "!=", count); process.exit(1); }
  s = s.replace(re instanceof RegExp ? re : new RegExp(re.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), to);
  n++; console.log("ok:", label);
}

// 1) SEO strony www nie ma sensu w aplikacji; kanoniczny adres zostaje w og:url dla udostępniania
rep(/<link rel="canonical"[^>]*>\n/, "", "canonical");
rep(/<script type="application\/ld\+json">[\s\S]*?<\/script>\n/, "", "json-ld");
// 2) fonty z paczki, nie z Google
rep(/<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">\n<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>\n<link href="https:\/\/fonts\.googleapis\.com\/css2[^"]*" rel="stylesheet">/,
  '<link href="vendor/fonts/fonts.css" rel="stylesheet">\n<style>[data-native-hide]{display:none!important}</style>', "fonty lokalne");
// 3) biblioteki z paczki + warstwa natywna przed silnikiem
rep('<script src="./support.js"></script>',
  '<script src="vendor/react.js"></script>\n<script src="vendor/react-dom.js"></script>\n<script src="vendor/supabase.js"></script>\n<script src="admob-config.js"></script>\n<script src="app-native.js"></script>\n<script src="./support.js"></script>', "skrypty lokalne");
// 4) bez Google Analytics i AdSense — kategoria dziecięca w sklepach; miejsce na AdMob zostaje w ORTUS_ADS
rep(/<script>\n\(function\(\)\{\n  if \(window\.__ortusTagInit\) return;[\s\S]*?\}\)\(\);\n<\/script>\n<\/helmet>/,
  "<script>\nwindow.ORTUS_ADS = { client:'', slot:'' };           // reklamy webowe wyłączone w aplikacji\nwindow.ortusConsentGrant = function(){};\n</script>\n</helmet>", "GA/AdSense usunięte");
// 5) supabase z paczki
rep('try{ this._supaLib=await import("https://esm.sh/@supabase/supabase-js@2.45.4"); }',
  'try{ this._supaLib=window.supabase || await import("https://esm.sh/@supabase/supabase-js@2.45.4"); }', "supabase lokalny");
// 6) logowanie Google: otwieramy w przeglądarce systemowej, wracamy własnym schematem adresu
rep('try{ await sb.auth.signInWithOAuth({provider, options:{redirectTo: window.location.origin + window.location.pathname}}); }',
  'try{ const {data,error}=await sb.auth.signInWithOAuth({provider, options:{redirectTo: window.ORTUS_AUTH_REDIRECT, skipBrowserRedirect:true}}); if(error) throw error; if(data&&data.url) window.ortusOpenExternal(data.url); }', "OAuth przez schemat");
rep('const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo: window.location.origin + window.location.pathname});',
  'const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo: "https://niekazmuliczyc.pl/gry/ortografia/"});', "reset hasła → strona www");
rep(`  async initAuth(){
    if(!this.supaCfg()) return;
    const sb=await this.supa(); if(!sb) return;`,
`  async initAuth(){
    if(!this.supaCfg()) return;
    const sb=await this.supa(); if(!sb) return;
    // aplikacja mobilna: adres powrotu z logowania przychodzi zdarzeniem, nie w pasku adresu
    const handleAuthUrl=async(u)=>{
      try{
        const url=new URL(u); const code=url.searchParams.get("code");
        const h=new URLSearchParams(String(url.hash||"").replace(/^#/,""));
        if(code){ const {error}=await sb.auth.exchangeCodeForSession(code); if(error) this.setState({authMsg:this.plErr(error.message)}); }
        else if(h.get("access_token")){ await sb.auth.setSession({access_token:h.get("access_token"), refresh_token:h.get("refresh_token")}); }
        else if(/error/.test(u)){ this.setState({authMsg:"Logowanie zostało przerwane."}); }
      }catch(e){ this.setState({authMsg:"Nie udało się dokończyć logowania."}); }
      this.setState({authBusy:false});
    };
    window.__ortusAuthHandler=handleAuthUrl; (window.__ortusAuthUrls||[]).splice(0).forEach(handleAuthUrl);`, "obsługa adresu powrotu");
// 7) rzeczy webowe, których w aplikacji nie ma: karta do druku i wysyłka mailem
rep('<a href="{{ shareHref }}" style=', '<a href="{{ shareHref }}" data-native-hide="1" style=', "ukryty mailto");
rep('<button onClick="{{ onDownload }}" style=', '<button onClick="{{ onDownload }}" data-native-hide="1" style=', "ukryty druk");
// 8) ekran awaryjny: w aplikacji nie ma „listy gier”
rep(`'<p style="margin:16px 0 0;font-size:13px"><a href="https://niekazmuliczyc.pl/gry/" style="color:#573AC0">'
      + 'Wróć do listy gier</a></p></div>';`, `'</div>';`, "fallback bez linku");
rep('Odśwież stronę; jeśli to n', 'Zamknij i otwórz aplikację ponownie; jeśli to n', "fallback tekst");
rep('>Odśwież stronę</button>', '>Spróbuj ponownie</button>', "fallback przycisk");

fs.writeFileSync(path.join(WWW, "index.html"), s);
console.log("zbudowano www/index.html —", n, "zmian;", fs.statSync(path.join(WWW, "index.html")).size, "B");
