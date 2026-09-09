// Mały serwer plików z nagłówkami CORS — żeby strona App Store Connect mogła pobrać zrzuty z dysku.
const fs = require("fs"), path = require("path"), http = require("http");
const KAT = "C:\\Users\\48607\\OneDrive\\Pulpit\\Audyt kotków\\play-grafiki\\ios";
http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split("?")[0]).replace(/^\//, "");
  const p = path.join(KAT, path.basename(u));
  if (q.method === "OPTIONS") { r.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" }); return r.end(); }
  fs.readFile(p, (e, d) => {
    if (e) { r.writeHead(404, { "Access-Control-Allow-Origin": "*" }); return r.end("404"); }
    r.writeHead(200, { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store", "Content-Type": "image/png" });
    r.end(d);
  });
}).listen(8156, () => console.log("serwer grafik na 8156"));
