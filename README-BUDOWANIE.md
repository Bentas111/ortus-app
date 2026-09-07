# Ortuś — aplikacja mobilna (Capacitor)

Ten katalog to gotowy projekt Android + iOS zbudowany z wersji webowej gry. Pliki gry
(`www/`) powstają skryptem z `../_pakiet/ortografia` — nie edytuj ich ręcznie.

## Co jest w środku

| Ścieżka | Co |
|---|---|
| `www/` | gra + biblioteki i fonty z paczki (działa bez internetu; internet tylko do konta i rankingu) |
| `build.js` | buduje `www/index.html` z wersji webowej: bez Google Analytics i AdSense, logowanie Google przez własny schemat adresu, bramka rodzica przed linkami, ukryty druk i mail |
| `app-native.js` | warstwa natywna: biblioteki lokalne, powrót z logowania, przycisk „wstecz", baner AdMob |
| `www/admob-config.js` | **tu wklejasz Banner ID** z AdMob (Android i iOS) |
| `android/` | projekt Android Studio (App ID AdMob w `AndroidManifest.xml`) |
| `ios/` | projekt Xcode (App ID AdMob w `Info.plist`) — wymaga Maca |
| `assets/` | ikona i ekran startowy (źródła 1024/2732 px); wygenerowane rozmiary już są w projektach |

## Po każdej zmianie w grze webowej

```bash
node build.js
npx cap sync
```

## Android — zbudowanie pliku do sklepu

1. Zainstaluj Android Studio (developer.android.com/studio), przy pierwszym uruchomieniu zaakceptuj pobranie SDK.
2. Android Studio → Open → wybierz katalog `ortus-app/android`. Poczekaj, aż Gradle skończy (pasek na dole, kilka minut za pierwszym razem).
3. Test na telefonie: włącz „Opcje programisty → Debugowanie USB", podłącz kabel, kliknij zielony trójkąt ▶.
4. Plik do Google Play: menu **Build → Generate Signed Bundle / APK → Android App Bundle → Next**
   → **Create new…** (klucz podpisu: zapisz plik `.jks` i hasła w bezpiecznym miejscu — bez nich nie wydasz aktualizacji)
   → wariant **release** → Finish. Plik `.aab` jest w `android/app/release/`.
5. Play Console → aplikacja → Produkcja → Utwórz nową wersję → wgraj `.aab`.

## iOS — wymaga Maca

1. Na Macu: `sudo gem install cocoapods`, potem w `ortus-app`: `npx cap sync ios`.
2. `npx cap open ios` → Xcode. Signing & Capabilities → Team: Twoje konto Apple Developer.
3. Product → Archive → Distribute App → App Store Connect.

## AdMob — kiedy dostaniesz ID

- **App ID** (z tyldą `~`): Android → `android/app/src/main/AndroidManifest.xml`, iOS → `ios/App/App/Info.plist`. W obu jest komentarz „zamień na własne".
- **Banner ID** (z ukośnikiem `/`): `www/admob-config.js`, pola `android.banner` i `ios.banner`. Ustaw `testing: false`.
- Po zmianie: `node build.js && npx cap sync`, przebuduj aplikację.

Reklamy są niespersonalizowane, oznaczone jako treść dla dzieci (`tagForChildDirectedTreatment`), ocena treści maksymalnie G.

## Ustawienia w sklepach — kategoria dla dzieci

**Google Play:** Zawartość aplikacji → Grupa docelowa: 6–8 i 9–12 lat → „Designed for Families": tak.
Bezpieczeństwo danych: zbierane e-mail (konto, opcjonalne), identyfikator użytkownika, postępy w aplikacji;
nie udostępniane; szyfrowane w tranzycie; użytkownik może poprosić o usunięcie (adres z polityki).
Reklamy: tak, przez certyfikowaną sieć (AdMob). Polityka prywatności: `https://niekazmuliczyc.pl/polityka-prywatnosci/`.

**App Store:** Kategoria Edukacja, Kids Category: 6–8. App Privacy: Email Address, User ID, Product Interaction
(linked to user, not used for tracking). Ocena wieku 4+. Parental gate przed linkami zewnętrznymi i logowaniem — jest.

## Co przetestować na telefonie przed wysłaniem

1. Tryb samolotowy → aplikacja startuje, lekcja działa, dyktando czyta (syntezator systemowy — Android potrzebuje polskiego głosu Google TTS).
2. Logowanie Google: otwiera przeglądarkę, po zalogowaniu wraca do aplikacji zalogowany.
3. Link „Prywatność" w stopce → pytanie dla rodzica → otwiera przeglądarkę.
4. Baner testowy AdMob widoczny na dole, nie zasłania przycisków.
5. Przycisk „wstecz" (Android) wraca do menu, z menu zamyka aplikację.
