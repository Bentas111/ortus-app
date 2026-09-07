/* Ortuś — warstwa natywna (Capacitor). Ładowana przed support.js.
   1) biblioteki z paczki zamiast z internetu, 2) powrót z logowania Google przez własny schemat adresu,
   3) bramka rodzica przed każdym wyjściem z aplikacji (wymóg sklepów dla kategorii dziecięcej),
   4) przycisk „wstecz” na Androidzie. */
(function () {
  // silnik widoku (support.js) pyta o tę mapę, zanim sięgnie do unpkg — offline działa
  window.__resources = {
    "https://unpkg.com/react@18.3.1/umd/react.production.min.js": "vendor/react.js",
    "https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js": "vendor/react-dom.js",
    "https://unpkg.com/@babel/standalone@7.29.0/babel.min.js": "vendor/babel.js"
  };
  window.ORTUS_NATIVE = true;
  window.ORTUS_AUTH_REDIRECT = "pl.niekazmuliczyc.ortus://auth";

  var C = window.Capacitor, P = (C && C.Plugins) ? C.Plugins : {};

  function openExternal(url) {
    try { if (P.Browser && P.Browser.open) { P.Browser.open({ url: url }); return; } } catch (e) {}
    try { window.open(url, "_system"); } catch (e) {}
  }
  window.ortusOpenExternal = openExternal;

  // bramka rodzica: proste działanie, jak przy zakładaniu konta
  function parentGate(cb) {
    var a = 2 + Math.floor(Math.random() * 7), b = 3 + Math.floor(Math.random() * 7);
    var ans = window.prompt("Ten link otwiera stronę poza aplikacją. Poproś rodzica lub opiekuna: ile to " + a + " × " + b + "?");
    if (ans !== null && parseInt(ans, 10) === a * b) cb();
  }
  document.addEventListener("click", function (e) {
    var t = e.target; if (!t || !t.closest) return;
    var a = t.closest("a[href]"); if (!a) return;
    var h = a.getAttribute("href") || "";
    if (/^https?:/i.test(h)) { e.preventDefault(); e.stopPropagation(); parentGate(function () { window.ortusOpenExternal(h); }); }
    else if (/^mailto:/i.test(h)) { e.preventDefault(); e.stopPropagation(); }
  }, true);

  // powrót z logowania: pl.niekazmuliczyc.ortus://auth?code=… — obsługę robi aplikacja (initAuth),
  // tu tylko kolejkujemy adres, gdyby przyszedł zanim aplikacja się obudzi
  window.__ortusAuthUrls = [];
  function onUrl(u) {
    if (!u || u.indexOf("pl.niekazmuliczyc.ortus://") !== 0) return;
    if (window.__ortusAuthHandler) window.__ortusAuthHandler(u); else window.__ortusAuthUrls.push(u);
    try { if (P.Browser && P.Browser.close) P.Browser.close(); } catch (e) {}
  }
  if (P.App && P.App.addListener) {
    P.App.addListener("appUrlOpen", function (ev) { onUrl(ev && ev.url); });
    if (P.App.getLaunchUrl) P.App.getLaunchUrl().then(function (r) { if (r && r.url) onUrl(r.url); }).catch(function () {});
    // Android „wstecz”: aplikacja prowadzi własną historię (pushState) — cofamy; z menu wychodzimy
    P.App.addListener("backButton", function (ev) {
      if (ev && ev.canGoBack) window.history.back();
      else if (P.App.exitApp) P.App.exitApp();
    });
  }

  // AdMob: baner na dole, tylko reklamy niespersonalizowane, treść dla dzieci (max rating G)
  function startAds() {
    var cfg = window.ORTUS_ADMOB, A = P.AdMob;
    if (!cfg || !cfg.enabled || !A || !C.getPlatform) return;
    var plat = C.getPlatform(); if (plat !== "android" && plat !== "ios") return;
    var unit = (cfg[plat] || {}).banner; if (!unit) return;
    A.addListener("bannerAdSizeChanged", function (s) {
      var h = (s && s.height) ? s.height : 0;
      document.body.style.paddingBottom = h ? (h + 8) + "px" : "";
    });
    A.initialize({ tagForChildDirectedTreatment: true, tagForUnderAgeOfConsent: true, maxAdContentRating: "G" })
      .then(function () {
        return A.showBanner({ adId: unit, adSize: "ADAPTIVE_BANNER", position: "BOTTOM_CENTER", margin: 0, isTesting: !!cfg.testing, npa: true });
      })
      .catch(function (e) { console.warn("AdMob:", e && e.message ? e.message : e); });
  }
  if (document.readyState === "complete") setTimeout(startAds, 1500);
  else window.addEventListener("load", function () { setTimeout(startAds, 1500); });
})();
