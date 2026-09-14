// Nagrywa wszystkie dyktanda głosem Arlety (ElevenLabs, model flash v2.5).
// Jeden plik na zdanie — aplikacja czyta dyktando zdanie po zdaniu.
// Można przerwać i uruchomić ponownie: gotowe pliki są pomijane.
const fs = require("fs"), path = require("path");

const KLUCZ = fs.readFileSync(path.join(__dirname, "eleven-key.txt"), "utf8").trim();
const GLOS = "F9eb9uZYeJuHuO7Uvs1R";           // Arleta — Calm Instructor, Clear Voice
const MODEL = "eleven_flash_v2_5";
const WYJ = "C:\\Users\\48607\\OneDrive\\Pulpit\\Audyt kotków\\lektor";
const PAKIET = "C:\\Users\\48607\\OneDrive\\Pulpit\\Audyt kotków\\_pakiet\\ortografia";
const ROWNOLEGLE = 3;                           // grzecznie dla limitów API

fs.mkdirSync(WYJ, { recursive: true });
global.window = {};
require(path.join(PAKIET, "dyktanda.js"));
const D = window.ORTUS_DICTATIONS;

// dokładnie ta sama reguła, co w aplikacji (index.html, splitSentences)
const nazwij = (i, n) => "d" + String(i + 1).padStart(3, "0") + "-s" + String(n + 1).padStart(2, "0") + ".mp3";
const zdaniaZ = (t) => String(t || "").split(/(?<=[.!?])\s+/).map(x => x.trim()).filter(Boolean);

async function mow(tekst) {
  for (let proba = 1; proba <= 4; proba++) {
    const r = await fetch("https://api.elevenlabs.io/v1/text-to-speech/" + GLOS + "?output_format=mp3_22050_32", {
      method: "POST",
      headers: { "xi-api-key": KLUCZ, "Content-Type": "application/json" },
      body: JSON.stringify({
        text: tekst, model_id: MODEL,
        voice_settings: { stability: 0.6, similarity_boost: 0.75, style: 0, speed: 0.9, use_speaker_boost: true }
      })
    });
    if (r.ok) return Buffer.from(await r.arrayBuffer());
    const tresc = (await r.text()).slice(0, 300);
    if (r.status === 401 && /quota|credit/i.test(tresc)) throw new Error("KONIEC KREDYTÓW: " + tresc);
    if (proba === 4) throw new Error(r.status + " " + tresc);
    await new Promise(x => setTimeout(x, 1500 * proba));   // 429 i przejściowe błędy
  }
}

(async () => {
  const zadania = [];
  const spis = [];
  D.forEach((d, i) => {
    const zd = zdaniaZ(d[3]);
    spis.push({ nr: i + 1, tytul: d[0], klasa: d[1], zdan: zd.length });
    zd.forEach((z, n) => {
      const plik = path.join(WYJ, nazwij(i, n));
      if (!fs.existsSync(plik) || fs.statSync(plik).size < 1000) zadania.push({ plik, tekst: z });
    });
  });
  fs.writeFileSync(path.join(WYJ, "spis.json"), JSON.stringify({ glos: "Arleta", model: MODEL, dyktanda: spis }, null, 1));

  console.log("do nagrania:", zadania.length, "z", spis.reduce((s, x) => s + x.zdan, 0), "zdań");
  if (!zadania.length) { console.log("wszystko już jest"); return; }

  let zrobione = 0, znaki = 0, blad = null;
  async function robotnik() {
    while (zadania.length && !blad) {
      const z = zadania.shift();
      try {
        const buf = await mow(z.tekst);
        fs.writeFileSync(z.plik, buf);
        zrobione++; znaki += z.tekst.length;
        if (zrobione % 50 === 0) console.log("  " + zrobione + " gotowe, " + znaki + " znaków");
      } catch (e) { blad = e; }
    }
  }
  await Promise.all(Array.from({ length: ROWNOLEGLE }, robotnik));

  console.log("\nnagrane teraz:", zrobione, "plików,", znaki, "znaków");
  if (blad) { console.error("PRZERWANE:", blad.message); process.exit(2); }
  console.log("gotowe:", WYJ);
})().catch(e => { console.error("BŁĄD:", e.message); process.exit(2); });
