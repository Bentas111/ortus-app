// Pakuje do wgrania to, co się zmieniło: index.html + katalog sklepy/.
// Archiwum składamy ręcznie, bo i Compress-Archive, i ZipFile::CreateFromDirectory
// zapisują na Windowsie ścieżki z odwrotnym ukośnikiem — a wtedy część
// rozpakowywarek tworzy plik o nazwie „sklepy\coś" zamiast katalogu.
const fs = require("fs"), path = require("path"), zlib = require("zlib");
const ZROD = "C:\\Users\\48607\\OneDrive\\Pulpit\\Audyt kotków\\_pakiet\\ortografia";
const ZIP = "C:\\Users\\48607\\OneDrive\\Pulpit\\Audyt kotków\\ortus-sklepy-do-wgrania.zip";
const PLIKI = ["index.html", "sklepy/app-store-pl.svg", "sklepy/google-play-pl.png"];

function crc32(buf) {
  let t = crc32.t;
  if (!t) { t = crc32.t = new Int32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ t[(c ^ buf[i]) & 0xFF];
  return (c ^ -1) >>> 0;
}

const lokalne = [], centralne = [];
let offset = 0;
for (const nazwa of PLIKI) {
  const zr = path.join(ZROD, nazwa.replace(/\//g, path.sep));
  if (!fs.existsSync(zr)) { console.error("BRAK:", zr); process.exit(2); }
  const dane = fs.readFileSync(zr);
  const spak = zlib.deflateRawSync(dane, { level: 9 });
  const nb = Buffer.from(nazwa, "utf8");          // zawsze zwykły ukośnik
  const suma = crc32(dane);

  const lh = Buffer.alloc(30);
  lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6);
  lh.writeUInt16LE(8, 8); lh.writeUInt16LE(0, 10); lh.writeUInt16LE(0x21, 12);
  lh.writeUInt32LE(suma, 14); lh.writeUInt32LE(spak.length, 18); lh.writeUInt32LE(dane.length, 22);
  lh.writeUInt16LE(nb.length, 26); lh.writeUInt16LE(0, 28);
  lokalne.push(lh, nb, spak);

  const ch = Buffer.alloc(46);
  ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6);
  ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(8, 10); ch.writeUInt16LE(0, 12); ch.writeUInt16LE(0x21, 14);
  ch.writeUInt32LE(suma, 16); ch.writeUInt32LE(spak.length, 20); ch.writeUInt32LE(dane.length, 24);
  ch.writeUInt16LE(nb.length, 28); ch.writeUInt32LE(offset, 42);
  centralne.push(ch, nb);
  offset += lh.length + nb.length + spak.length;
}

const cd = Buffer.concat(centralne);
const eocd = Buffer.alloc(22);
eocd.writeUInt32LE(0x06054b50, 0);
eocd.writeUInt16LE(PLIKI.length, 8); eocd.writeUInt16LE(PLIKI.length, 10);
eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(offset, 16);
fs.writeFileSync(ZIP, Buffer.concat([...lokalne, cd, eocd]));

// kontrola: czytamy własne archiwum tak, jak przeczyta je serwer
const { execFileSync } = require("child_process");
const q = (s) => "'" + s.replace(/'/g, "''") + "'";
const lista = execFileSync("powershell.exe", ["-NoProfile", "-Command",
  "Add-Type -A System.IO.Compression.FileSystem; " +
  "[IO.Compression.ZipFile]::OpenRead(" + q(ZIP) + ").Entries | % { $_.FullName + '|' + $_.Length }"
], { encoding: "utf8" }).trim().split(/\r?\n/).map(x => x.trim());

console.log("zawartość archiwum:");
lista.forEach(x => { const [n, d] = x.split("|"); console.log("  " + n.padEnd(34) + d + " B"); });
const nazwy = lista.map(x => x.split("|")[0]);
const ok = nazwy.includes("index.html")
  && nazwy.filter(n => n.startsWith("sklepy/")).length === 2
  && !nazwy.some(n => n.includes("\\"));
console.log("\nścieżki ze zwykłym ukośnikiem :", nazwy.some(n => n.includes("\\")) ? "NIE" : "tak");
console.log("index.html + 2 pliki w sklepy/:", ok ? "tak" : "NIE");
console.log("rozmiar archiwum:", fs.statSync(ZIP).size, "B");
if (!ok) process.exit(3);
