// Reklamy AdMob w aplikacji mobilnej. Baner na dole ekranu, niespersonalizowany, oznaczony jako dla dzieci.
// Wklej tu identyfikatory JEDNOSTEK (Banner ID, z ukośnikiem: ca-app-pub-…/…).
// App ID (z tyldą: ca-app-pub-…~…) wpisuje się osobno: android/app/src/main/AndroidManifest.xml
// i ios/App/App/Info.plist — w obu jest komentarz, gdzie.
// Dopóki testing = true, pokazują się reklamy testowe Google (nie zarabiają, ale nie łamią zasad).
window.ORTUS_ADMOB = {
  enabled: true,
  testing: true,
  android: { banner: "ca-app-pub-3940256099942544/6300978111" },   // testowy baner Google
  ios:     { banner: "ca-app-pub-3940256099942544/2934735716" }    // testowy baner Google
};
