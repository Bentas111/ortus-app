// Statyczny serwer strony Ortusia na porcie 8149 — do oglądania i mierzenia zmian.
const fs = require("fs"), path = require("path"), http = require("http");
const KAT = "C:\\Users\\48607\\OneDrive\\Pulpit\\Audyt kotków\\_pakiet\\ortografia";
const TYPY = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".xml": "application/xml" };

http.createServer((q, r) => {
  let u = decodeURIComponent(q.url.split("?")[0]);
  if (u === "/" || u === "") u = "/index.html";
  const p = path.join(KAT, u.replace(/^\//, ""));
  if (!p.startsWith(KAT)) { r.writeHead(403); return r.end("403"); }
  fs.readFile(p, (e, d) => {
    if (e) { r.writeHead(404, { "Content-Type": "text/plain" }); return r.end("404"); }
    r.writeHead(200, { "Content-Type": TYPY[path.extname(p).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store" });
    r.end(d);
  });
}).listen(8149, () => console.log("Ortuś na http://localhost:8149/"));
