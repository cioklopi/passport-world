"use strict";
/* EarthPass server: serves the game and builds real-map city tiles from OpenStreetMap (Overpass API).
   Run: node server.js   (port 8080, or PORT env).  Build a city ahead of time: node server.js build JFK */
const http = require("http"), fs = require("fs"), path = require("path"), zlib = require("zlib");
const { convert, overpassQuery } = require("./osm2tiles");
const ROOT = __dirname, PUB = path.join(ROOT, "public"), CACHE = path.join(ROOT, "cities");
const CITIES = JSON.parse(fs.readFileSync(path.join(ROOT, "cities.json"), "utf8"));
const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter"];
const HALF = 1500, BLOCKS = 4, MAXDEPTH = 2;
const jobs = {};
fs.mkdirSync(CACHE, { recursive: true });

const sleep = ms => new Promise(r => setTimeout(r, ms));
let mirror = 0;
/* One Overpass request, rotating mirrors. Returns elements, or null if every try failed. */
async function overpass(q, tries) {
  for (let a = 0; a < tries; a++) {
    const url = OVERPASS[mirror % OVERPASS.length];
    const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 200000);
    try {
      const r = await fetch(url, { method: "POST", body: "data=" + encodeURIComponent(q), signal: ctl.signal, headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "EarthPass/1.0 (game map builder)" } });
      if (r.ok) {
        const d = await r.json(); clearTimeout(tm);
        if (d.remark && /error|timed out|out of memory/i.test(d.remark)) console.log("overpass remark", url, d.remark.slice(0, 120));
        else return d.elements || [];
      } else { clearTimeout(tm); console.log("overpass", url, r.status); }
    } catch (e) { clearTimeout(tm); console.log("overpass error", url, e.message); }
    mirror++;
    await sleep(4000 + a * 3000);
  }
  return null;
}
/* Fetch one box. Finished boxes are saved to disk, so a restart resumes where it stopped.
   A box that keeps failing (too dense) is split into 4 smaller boxes. */
async function fetchArea(code, b, depth, key) {
  const dir = path.join(CACHE, code + ".parts"), f = path.join(dir, key + ".json");
  fs.mkdirSync(dir, { recursive: true });
  if (fs.existsSync(f)) { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { } }
  const els = await overpass(overpassQuery(b.s, b.w, b.n, b.e), depth < MAXDEPTH ? 3 : 8);
  if (els) { fs.writeFileSync(f, JSON.stringify(els)); console.log(code, "box", key, "ok", els.length); return els; }
  if (depth >= MAXDEPTH) throw new Error("Overpass failed for box " + key);
  console.log(code, "box", key, "too slow, splitting into 4");
  const mx = (b.w + b.e) / 2, my = (b.s + b.n) / 2, out = [];
  const subs = [{ s: b.s, w: b.w, n: my, e: mx }, { s: b.s, w: mx, n: my, e: b.e }, { s: my, w: b.w, n: b.n, e: mx }, { s: my, w: mx, n: b.n, e: b.e }];
  for (let i = 0; i < 4; i++) { const r = await fetchArea(code, subs[i], depth + 1, key + "_" + i); for (const x of r) out.push(x); await sleep(1500); }
  return out;
}
async function buildCity(code) {
  const c = CITIES[code]; if (!c) throw new Error("unknown city " + code);
  const job = jobs[code] = { progress: 0, started: Date.now() };
  const kx = Math.cos(c.lat * Math.PI / 180) * 111320, kz = 110540, step = (HALF * 2) / BLOCKS, pad = 60;
  const seen = new Set(), elements = [];
  for (let i = 0; i < BLOCKS; i++) for (let j = 0; j < BLOCKS; j++) {
    const x1 = -HALF + i * step - pad, x2 = -HALF + (i + 1) * step + pad, z1 = -HALF + j * step - pad, z2 = -HALF + (j + 1) * step + pad;
    const b = { w: c.lon + x1 / kx, e: c.lon + x2 / kx, n: c.lat - z1 / kz, s: c.lat - z2 / kz };
    const els = await fetchArea(code, b, 0, "b" + i + j);
    for (const el of els) { const k = el.type[0] + el.id; if (!seen.has(k)) { seen.add(k); elements.push(el); } }
    job.progress = (i * BLOCKS + j + 1) / (BLOCKS * BLOCKS) * 0.92;
    console.log(code, "block", i, j, "elements", elements.length);
    await sleep(1500);
  }
  const res = convert(elements, { lat: c.lat, lon: c.lon, half: HALF, tile: 250 });
  const tmp = path.join(CACHE, code + ".tmp"); fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true });
  for (const [k, t] of res.tiles) fs.writeFileSync(path.join(tmp, "t_" + k + ".json"), JSON.stringify(t));
  fs.writeFileSync(path.join(tmp, "overview.json"), JSON.stringify(res.overview));
  res.meta.code = code; res.meta.name = c.name;
  fs.writeFileSync(path.join(tmp, "meta.json"), JSON.stringify(res.meta));
  const dir = path.join(CACHE, code); fs.rmSync(dir, { recursive: true, force: true }); fs.renameSync(tmp, dir);
  fs.rmSync(path.join(CACHE, code + ".parts"), { recursive: true, force: true });
  job.progress = 1; job.done = true; console.log(code, "built", res.tiles.size, "tiles");
}
function startBuild(code) {
  if (jobs[code] && !jobs[code].done && !jobs[code].error) return;
  const prev = jobs[code] ? jobs[code].progress || 0 : 0;
  buildCity(code).catch(e => { console.log("build failed, retrying in 1 minute", code, e.message); jobs[code] = { error: e.message, progress: prev }; setTimeout(() => startBuild(code), 60000); });
}

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
function send(req, res, file, extra) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end("Not found"); }
    if (path.basename(file) === "index.html") {
      let html = fs.readFileSync(file, "utf8"); const inject = '<script>window.PW_SERVER="/api";</script>';
      if (!/^\s*<!doctype/i.test(html)) html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>EarthPass</title></head><body>' + inject + html + '</body></html>';
      else html = html.replace(/<script/i, inject + "<script");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" }); return res.end(html);
    }
    const type = TYPES[path.extname(file)] || "application/octet-stream", gz = /gzip/.test(req.headers["accept-encoding"] || "") && /json|javascript|html|css|svg/.test(type);
    const h = Object.assign({ "Content-Type": type, "Cache-Control": /\.html$/.test(file) ? "no-cache" : "public, max-age=3600" }, extra || {});
    if (gz) { h["Content-Encoding"] = "gzip"; res.writeHead(200, h); fs.createReadStream(file).pipe(zlib.createGzip({ level: 6 })).pipe(res); }
    else { h["Content-Length"] = st.size; res.writeHead(200, h); fs.createReadStream(file).pipe(res); }
  });
}
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split("?")[0]);
  const m = u.match(/^\/api\/city\/([A-Z]{3})\/((?:t_\d+_\d+|meta|overview)\.json)$/);
  if (m) {
    const code = m[1], dir = path.join(CACHE, code);
    if (!CITIES[code]) { res.writeHead(404); return res.end("Unknown city"); }
    if (!fs.existsSync(path.join(dir, "meta.json"))) {
      startBuild(code); const j = jobs[code] || {};
      res.writeHead(202, { "Content-Type": "application/json", "Cache-Control": "no-store" }); return res.end(JSON.stringify({ building: true, progress: j.progress || 0, error: j.error || null }));
    }
    return send(req, res, path.join(dir, m[2]));
  }
  if (u === "/api/cities") { res.writeHead(200, { "Content-Type": "application/json" }); return res.end(JSON.stringify(Object.keys(CITIES).map(k => ({ code: k, name: CITIES[k].name, ready: fs.existsSync(path.join(CACHE, k, "meta.json")), progress: jobs[k] ? jobs[k].progress : 0 })))); }
  let f = path.normalize(path.join(PUB, u === "/" ? "index.html" : u));
  if (!f.startsWith(PUB)) { res.writeHead(403); return res.end(); }
  send(req, res, f);
});

if (process.argv[2] === "build") {
  const list = process.argv[3] === "all" ? Object.keys(CITIES) : process.argv.slice(3);
  (async () => { for (const c of list) { if (fs.existsSync(path.join(CACHE, c, "meta.json")) && process.argv[3] === "all") continue; try { await buildCity(c); } catch (e) { console.log(c, e.message); } } })();
} else {
  const port = +process.env.PORT || 8080;
  server.listen(port, () => console.log("EarthPass on port " + port));
  if (!fs.existsSync(path.join(CACHE, "JFK", "meta.json"))) startBuild("JFK");
}
