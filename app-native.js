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
  // ta sama bramka pilnuje zakupu abonamentu — aplikacja woła ją przed otwarciem sklepu
  window.ortusParentGate = parentGate;
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
    if (window.ORTUS_BEZ_REKLAM) return;      // aktywny abonament — nie ruszamy reklam w ogóle
    var plat = C.getPlatform(); if (plat !== "android" && plat !== "ios") return;
    var ids = cfg[plat] || {};
    if (ids.banner) A.addListener("bannerAdSizeChanged", function (s) {
      var h = (s && s.height) ? s.height : 0;
      document.body.style.paddingBottom = h ? (h + 8) + "px" : "";
    });
    A.initialize({ tagForChildDirectedTreatment: true, tagForUnderAgeOfConsent: true, maxAdContentRating: "G" })
      .then(function () {
        pelnoekranowa.wlacz(A, ids.pelnoekranowa, cfg);
        if (!ids.banner) return;
        return A.showBanner({ adId: ids.banner, adSize: "ADAPTIVE_BANNER", position: "BOTTOM_CENTER", margin: 0, isTesting: !!cfg.testing, npa: true });
      })
      .catch(function (e) { console.warn("AdMob:", e && e.message ? e.message : e); });
  }

  // Reklama pełnoekranowa — tylko po skończonej lekcji.
  // Google Play zabrania takich reklam przy starcie aplikacji i w trakcie zabawy, więc jedyne
  // miejsce, w którym ją pokazujemy, to ekran podsumowania. Do tego limit czasu i pierwsze
  // lekcje bez przerywnika, żeby dziecko zdążyło wejść w rytm.
  var pelnoekranowa = {
    A: null, unit: "", cfg: null, gotowa: false, ostatnia: 0, lekcje: 0,
    wlacz: function (A, unit, cfg) {
      if (!unit) return;                       // brak jednostki = format wyłączony
      this.A = A; this.unit = unit; this.cfg = cfg;
      var self = this;
      A.addListener("interstitialAdLoaded", function () { self.gotowa = true; });
      A.addListener("interstitialAdFailedToLoad", function () { self.gotowa = false; });
      A.addListener("interstitialAdDismissed", function () { self.gotowa = false; self.przygotuj(); });
      this.przygotuj();
    },
    przygotuj: function () {
      if (!this.A || !this.unit) return;
      var self = this;
      this.A.prepareInterstitial({ adId: this.unit, isTesting: !!this.cfg.testing, npa: true })
        .then(function () { self.gotowa = true; })
        .catch(function () { self.gotowa = false; });
    },
    poLekcji: function () {
      this.lekcje++;
      if (window.ORTUS_BEZ_REKLAM) return;
      if (!this.A || !this.unit) return;
      if (this.lekcje <= (this.cfg.lekcjiPrzedPierwsza || 0)) return;
      if (Date.now() - this.ostatnia < (this.cfg.odstepPelnoekranowej || 0)) return;
      if (!this.gotowa) { this.przygotuj(); return; }
      this.ostatnia = Date.now(); this.gotowa = false;
      var self = this;
      this.A.showInterstitial().catch(function () { self.przygotuj(); });
    }
  };
  // aplikacja woła to po zamknięciu lekcji; na stronie www funkcji nie ma i nic się nie dzieje
  window.ortusLessonDone = function () { try { pelnoekranowa.poLekcji(); } catch (e) {} };

  // Abonament mógł się potwierdzić już po starcie reklam (logowanie idzie asynchronicznie),
  // więc trzeba umieć zdjąć baner z ekranu w locie.
  window.ortusUkryjReklamy = function () {
    try {
      if (P.AdMob && P.AdMob.removeBanner) P.AdMob.removeBanner().catch(function () {});
      document.body.style.paddingBottom = "";
    } catch (e) {}
  };
  if (document.readyState === "complete") setTimeout(startAds, 1500);
  else window.addEventListener("load", function () { setTimeout(startAds, 1500); });

  // ---- Sign in with Apple natywnie ----------------------------------------
  // W aplikacji Apple chce własnego okienka systemowego, nie przekierowania przez
  // przeglądarkę. Apple dostaje skrót SHA-256 z jednorazowego ciągu, Supabase ten
  // sam ciąg w oryginale — tak dowodzi, że token nie został podstawiony.
  function losowyNonce() {
    var b = new Uint8Array(16);
    (window.crypto || {}).getRandomValues ? window.crypto.getRandomValues(b) : b.forEach(function (_, i) { b[i] = Math.floor(Math.random() * 256); });
    return Array.prototype.map.call(b, function (x) { return ("0" + x.toString(16)).slice(-2); }).join("");
  }
  function skrot(tekst) {
    return window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(tekst)).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (x) { return ("0" + x.toString(16)).slice(-2); }).join("");
    });
  }
  window.ortusAppleNative = function () {
    var A = P.SignInWithApple;
    if (!A || !A.authorize) return Promise.resolve(null);
    var surowy = losowyNonce();
    return skrot(surowy)
      .then(function (h) {
        return A.authorize({ clientId: "pl.niekazmuliczyc.ortus", redirectURI: window.ORTUS_AUTH_REDIRECT, scopes: "email name", nonce: h });
      })
      .then(function (r) {
        var t = r && r.response && r.response.identityToken;
        return t ? { token: t, nonce: surowy } : null;
      });
  };

  // ---- Abonament „bez reklam" ----------------------------------------------
  // Most między aplikacją a sklepem. Rozmawiamy wprost z natywną wtyczką
  // (capacitor-plugin-cdv-purchase → StoreKit 2), z pominięciem jej warstwy
  // TypeScript — bo Ortuś nie ma bundlera, a ta warstwa jest modułem ES.
  // Wtyczka wymaga iOS 15+; na starszych odrzuca init i ekran pokazuje, że
  // zakup jest niedostępny. Kontrakt mostu opisany w index.html przy sklepMost().
  (function sklep() {
    var W = P.PurchasePlugin;
    if (!W || !C.getPlatform) return;
    var plat = C.getPlatform();
    if (plat !== "ios" && plat !== "android") return;

    var gotowy = null;                 // Promise z init
    var ostatnia = null;               // najświeższa znana transakcja z datą ważności
    var oczekujace = [];               // funkcje czekające na wynik zakupu/przywracania

    function zapamietaj(t) {
      if (!t || !t.expirationDate) return null;
      var doKiedy = new Date(Number(t.expirationDate)).toISOString();
      var info = { aktywnaDo: doKiedy, produkt: t.productId || "" };
      // trzymamy najdalszą datę — przy odnowieniu przychodzi kilka transakcji
      if (!ostatnia || new Date(info.aktywnaDo) > new Date(ostatnia.aktywnaDo)) ostatnia = info;
      return info;
    }
    function rozliczOczekujace(info, blad) {
      var lista = oczekujace; oczekujace = [];
      lista.forEach(function (o) { blad ? o.reject(blad) : o.resolve(info); });
    }

    W.addListener("transactionUpdated", function (t) {
      var info = zapamietaj(t);
      // StoreKit trzyba potwierdzić, że transakcja została obsłużona, inaczej wraca w kółko
      if (t && t.transactionIdentifier && /Purchased|Restored/.test(t.state || "")) {
        try { W.finish({ transactionId: t.transactionIdentifier }); } catch (e) {}
      }
      if (/Purchased|Restored/.test(t.state || "")) {
        if (info) rozliczOczekujace(info);
      } else if ((t.state || "") === "PaymentTransactionStateFailed") {
        // 6777006 = użytkownik zrezygnował; to nie jest błąd do pokazania
        rozliczOczekujace(null, Number(t.errorCode) === 6777006 ? null : new Error(t.errorText || "Zakup się nie powiódł"));
      }
    });

    function start() {
      if (!gotowy) gotowy = W.init({ debug: false }).catch(function (e) { gotowy = null; throw e; });
      return gotowy;
    }
    // czekamy na transakcję, ale nie w nieskończoność — StoreKit potrafi milczeć
    function czekaj(ms) {
      return new Promise(function (resolve, reject) {
        var domkniete = false;
        var wpis = {
          resolve: function (v) { if (!domkniete) { domkniete = true; resolve(v); } },
          reject: function (e) { if (!domkniete) { domkniete = true; reject(e); } }
        };
        oczekujace.push(wpis);
        setTimeout(function () { wpis.resolve(ostatnia); }, ms || 30000);
      });
    }

    window.ortusSklep = {
      platforma: plat === "ios" ? "apple" : "google",
      produkty: function (ids) {
        return start().then(function () { return W.load({ productIds: ids }); }).then(function (r) {
          return ((r && r.validProducts) || []).map(function (p) {
            return { id: p.id, cena: p.price, okres: p.billingPeriodUnit || "", tytul: p.title };
          });
        });
      },
      kup: function (id) {
        return start().then(function () {
          var czekanie = czekaj(120000);          // okno płatności bywa długie
          return W.purchase({ productId: id }).then(function () { return czekanie; });
        });
      },
      przywroc: function () {
        return start().then(function () {
          var czekanie = czekaj(20000);
          return W.restore().then(function () { return czekanie; });
        });
      },
      stan: function () {
        // init sam zgłasza aktywne uprawnienia zdarzeniem, więc dajemy mu chwilę
        return start().then(function () {
          return new Promise(function (r) { setTimeout(function () { r(ostatnia); }, 1200); });
        }).catch(function () { return null; });
      },
      zarzadzaj: function () { try { return W.manageSubscriptions(); } catch (e) { return Promise.resolve(); } }
    };
  })();
})();
