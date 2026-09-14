// Próbka lektora: jedno dyktando, kilka wariantów głosu i modelu.
// Klucz czytamy z pliku, nigdzie go nie wypisujemy.
const fs = require("fs"), path = require("path");
const KLUCZ = fs.readFileSync(path.join(__dirname, "eleven-key.txt"), "utf8").trim();
const WYJ = "C:\\Users\\48607\\OneDrive\\Pulpit\\Audyt kotków\\lektor-probka";
fs.mkdirSync(WYJ, { recursive: true });

const WARIANTY = [
  { nazwa: "arleta-flash",        glos: "F9eb9uZYeJuHuO7Uvs1R", model: "eleven_flash_v2_5" },
  { nazwa: "arleta-multilingual", glos: "F9eb9uZYeJuHuO7Uvs1R", model: "eleven_multilingual_v2" },
  { nazwa: "maria-multilingual",  glos: "d4Z5Fvjohw3zxGpV8XUV", model: "eleven_multilingual_v2" },
  { nazwa: "konrad-multilingual", glos: "tXHjRsOjrGCwL3SyA7ay", model: "eleven_multilingual_v2" }
];

global.window = {};
require(path.join("C:\\Users\\48607\\OneDrive\\Pulpit\\Audyt kotków\\_pakiet\\ortografia", "dyktanda.js"));
const D = window.ORTUS_DICTATIONS;
const dyktando = D[0];                       // „Mój piesek", klasa 1, krótkie
const zdania = dyktando[3].split(/(?<=[.!?])\s+/).filter(s => s.trim());

async function mow(tekst, glos, model) {
  const r = await fetch("https://api.elevenlabs.io/v1/text-to-speech/" + glos + "?output_format=mp3_22050_32", {
    method: "POST",
    headers: { "xi-api-key": KLUCZ, "Content-Type": "application/json" },
    body: JSON.stringify({
      text: tekst, model_id: model,
      // spokojne tempo i powtarzalna dykcja — dziecko ma zdążyć zapisać
      voice_settings: { stability: 0.6, similarity_boost: 0.75, style: 0, speed: 0.9, use_speaker_boost: true }
    })
  });
  if (!r.ok) throw new Error(r.status + " " + (await r.text()).slice(0, 200));
  return Buffer.from(await r.arrayBuffer());
}

(async () => {
  console.log("dyktando:", dyktando[0], "|", zdania.length, "zdań,", dyktando[3].length, "znaków");
  for (const w of WARIANTY) {
    // całe dyktando jednym plikiem — do odsłuchu wygodniej niż zdanie po zdaniu
    const buf = await mow(dyktando[3], w.glos, w.model);
    const plik = path.join(WYJ, "probka-" + w.nazwa + ".mp3");
    fs.writeFileSync(plik, buf);
    console.log("  →", path.basename(plik), Math.round(buf.length / 1024) + " kB");
  }
  console.log("\ngotowe:", WYJ);
})().catch(e => { console.error("BŁĄD:", e.message); process.exit(2); });
