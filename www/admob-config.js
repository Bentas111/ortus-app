// Reklamy AdMob w aplikacji mobilnej. Niespersonalizowane, oznaczone jako treść dla dzieci.
// Wklej tu identyfikatory JEDNOSTEK (z ukośnikiem: ca-app-pub-…/…).
// App ID (z tyldą: ca-app-pub-…~…) wpisuje się osobno: android/app/src/main/AndroidManifest.xml
// i ios/App/App/Info.plist — w obu jest komentarz, gdzie.
// Dopóki testing = true, pokazują się reklamy testowe Google (nie zarabiają, ale nie łamią zasad).
//
// Pełnoekranowa reklama pokazuje się WYŁĄCZNIE po skończonej lekcji — nigdy przy starcie
// aplikacji ani w trakcie ćwiczenia. Tak wymaga polityka Google Play dla aplikacji rodzinnych.
// Puste pole = format wyłączony, więc do czasu założenia jednostki nic się nie dzieje.
window.ORTUS_ADMOB = {
  enabled: true,
  testing: false,
  odstepPelnoekranowej: 4 * 60 * 1000,   // nie częściej niż raz na cztery minuty
  lekcjiPrzedPierwsza: 2,                // pierwsze dwie lekcje w spokoju, bez przerywnika
  android: {
    banner: "ca-app-pub-1505849560454642/9140874833",          // Ortuś baner (AdMob, 7.09.2026)
    pelnoekranowa: "ca-app-pub-1505849560454642/9207521117"    // po lekcji (AdMob, 16.09.2026)
  },
  ios: {
    banner: "ca-app-pub-1505849560454642/7731124629",          // Ortus baner iOS (AdMob, 13.09.2026)
    pelnoekranowa: "ca-app-pub-1505849560454642/6441309862"    // po lekcji (AdMob, 16.09.2026)
  }
};
