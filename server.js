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

/* ---------- Map file mode: download an OpenStreetMap extract (.osm.pbf) and read only the city area.
   This does not depend on the busy public Overpass servers. ---------- */
const PBF_SOURCES = {
  JFK: ["https://download.geofabrik.de/north-america/us/new-york-latest.osm.pbf", "https://download.bbbike.org/osm/bbbike/NewYork/NewYork.osm.pbf"]
};
function PB(b, p, e) { this.b = b; this.p = p || 0; this.e = e === undefined ? b.length : e; }
PB.prototype.v = function () { const b = this.b; let r = 0, m = 1, c; do { c = b[this.p++]; r += (c & 127) * m; m *= 128; } while (c >= 128); return r; };
PB.prototype.next = function () { if (this.p >= this.e) return false; const k = this.v(); this.f = Math.floor(k / 8); this.t = k & 7; return true; };
PB.prototype.len = function () { const n = this.v(), s = this.p; this.p += n; return [s, this.p]; };
PB.prototype.skip = function () { const t = this.t; if (t === 0) this.v(); else if (t === 1) this.p += 8; else if (t === 2) { const n = this.v(); this.p += n; } else if (t === 5) this.p += 4; else throw new Error("bad wire type"); };
const zz = n => (n % 2 === 1 ? -(n + 1) / 2 : n / 2);
const i64 = n => (n >= 9223372036854775807 ? n - 18446744073709551616 : n);
function packed(b, r) { const pb = new PB(b, r[0], r[1]), out = []; while (pb.p < pb.e) out.push(pb.v()); return out; }
function readPbf(file, box, onProgress) {
  const fd = fs.openSync(file, "r"), size = fs.fstatSync(fd).size, N = new Map(), W = new Map(), R = [];
  const hdr = Buffer.alloc(4); let pos = 0;
  const rd = n => { const b = Buffer.alloc(n); let got = 0; while (got < n) { const k = fs.readSync(fd, b, got, n - got, pos + got); if (!k) throw new Error("map file is cut short"); got += k; } pos += n; return b; };
  try {
    while (pos < size) {
      fs.readSync(fd, hdr, 0, 4, pos); pos += 4;
      const hb = rd(hdr.readUInt32BE(0)), h = new PB(hb); let type = "", dsz = 0;
      while (h.next()) { if (h.f === 1) { const r = h.len(); type = hb.toString("utf8", r[0], r[1]); } else if (h.f === 3) dsz = h.v(); else h.skip(); }
      const blob = rd(dsz);
      if (type !== "OSMData") continue;
      const bp = new PB(blob); let data = null;
      while (bp.next()) { if (bp.f === 1) { const r = bp.len(); data = blob.subarray(r[0], r[1]); } else if (bp.f === 3) { const r = bp.len(); data = zlib.inflateSync(blob.subarray(r[0], r[1])); } else if (bp.f === 4 || bp.f === 7) throw new Error("unsupported map compression"); else bp.skip(); }
      if (data) block(data);
      if (onProgress) onProgress(pos / size);
    }
  } finally { fs.closeSync(fd); }
  function block(b) {
    const pb = new PB(b), groups = []; let st = null, gran = 100, lato = 0, lono = 0;
    while (pb.next()) {
      if (pb.f === 1) st = pb.len(); else if (pb.f === 2) groups.push(pb.len());
      else if (pb.f === 17) gran = pb.v(); else if (pb.f === 19) lato = i64(pb.v()); else if (pb.f === 20) lono = i64(pb.v()); else pb.skip();
    }
    let strs = null;
    const S = i => { if (!strs) { strs = []; const sp = new PB(b, st[0], st[1]); while (sp.next()) { if (sp.f === 1) { const r = sp.len(); strs.push(b.toString("utf8", r[0], r[1])); } else sp.skip(); } } return strs[i]; };
    const tagsOf = (ks, vs) => { if (!ks.length) return undefined; const t = {}; for (let i = 0; i < ks.length; i++) t[S(ks[i])] = S(vs[i]); return t; };
    for (const g of groups) {
      const gp = new PB(b, g[0], g[1]);
      while (gp.next()) {
        const r = gp.t === 2 ? gp.len() : (gp.skip(), null); if (!r) continue;
        if (gp.f === 2) dense(r); else if (gp.f === 1) node(r); else if (gp.f === 3) way(r); else if (gp.f === 4) rel(r);
      }
    }
    function inBox(lat, lon) { return lat >= box.s && lat <= box.n && lon >= box.w && lon <= box.e; }
    function dense(r) {
      const p = new PB(b, r[0], r[1]); let ids, lats, lons, kv = null;
      while (p.next()) { if (p.f === 1) ids = p.len(); else if (p.f === 8) lats = p.len(); else if (p.f === 9) lons = p.len(); else if (p.f === 10) kv = p.len(); else p.skip(); }
      if (!ids) return;
      const I = new PB(b, ids[0], ids[1]), A = new PB(b, lats[0], lats[1]), O = new PB(b, lons[0], lons[1]), K = kv ? new PB(b, kv[0], kv[1]) : null;
      let id = 0, la = 0, lo = 0;
      while (I.p < I.e) {
        id += zz(I.v()); la += zz(A.v()); lo += zz(O.v());
        const lat = 1e-9 * (lato + gran * la), lon = 1e-9 * (lono + gran * lo), keep = inBox(lat, lon);
        let tags;
        if (K && K.p < K.e) { for (;;) { const k = K.v(); if (k === 0) break; const v = K.v(); if (keep) { (tags || (tags = {}))[S(k)] = S(v); } } }
        if (keep) N.set(id, { type: "node", id, lat, lon, tags });
      }
    }
    function node(r) {
      const p = new PB(b, r[0], r[1]); let id = 0, la = 0, lo = 0, ks = [], vs = [];
      while (p.next()) { if (p.f === 1) id = zz(p.v()); else if (p.f === 2) ks = packed(b, p.len()); else if (p.f === 3) vs = packed(b, p.len()); else if (p.f === 8) la = zz(p.v()); else if (p.f === 9) lo = zz(p.v()); else p.skip(); }
      const lat = 1e-9 * (lato + gran * la), lon = 1e-9 * (lono + gran * lo);
      if (inBox(lat, lon)) N.set(id, { type: "node", id, lat, lon, tags: tagsOf(ks, vs) });
    }
    function way(r) {
      const p = new PB(b, r[0], r[1]); let id = 0, ks = [], vs = [], refs = null;
      while (p.next()) { if (p.f === 1) id = p.v(); else if (p.f === 2) ks = packed(b, p.len()); else if (p.f === 3) vs = packed(b, p.len()); else if (p.f === 8) refs = p.len(); else p.skip(); }
      if (!refs) return;
      const rp = new PB(b, refs[0], refs[1]), nodes = []; let ref = 0, hit = false;
      while (rp.p < rp.e) { ref += zz(rp.v()); nodes.push(ref); if (!hit && N.has(ref)) hit = true; }
      if (hit) W.set(id, { type: "way", id, nodes, tags: tagsOf(ks, vs) });
    }
    function rel(r) {
      const p = new PB(b, r[0], r[1]); let id = 0, ks = [], vs = [], roles = [], mids = null, types = [];
      while (p.next()) { if (p.f === 1) id = p.v(); else if (p.f === 2) ks = packed(b, p.len()); else if (p.f === 3) vs = packed(b, p.len()); else if (p.f === 8) roles = packed(b, p.len()); else if (p.f === 9) mids = p.len(); else if (p.f === 10) types = packed(b, p.len()); else p.skip(); }
      if (!mids || !ks.length) return;
      const mp = new PB(b, mids[0], mids[1]), members = []; let ref = 0, hit = false, i = 0;
      while (mp.p < mp.e) { ref += zz(mp.v()); const t = types[i] === 0 ? "node" : types[i] === 1 ? "way" : "relation"; members.push({ type: t, ref, role: S(roles[i]) || "" }); if (!hit && ((t === "way" && W.has(ref)) || (t === "node" && N.has(ref)))) hit = true; i++; }
      if (hit) R.push({ type: "relation", id, members, tags: tagsOf(ks, vs) });
    }
  }
  const out = []; for (const n of N.values()) out.push(n); for (const w of W.values()) out.push(w); for (const r of R) out.push(r);
  return out;
}
async function download(url, file, onProgress) {
  const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 45 * 60000);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { "User-Agent": "EarthPass/1.0 (game map builder)" } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const total = +r.headers.get("content-length") || 0, ws = fs.createWriteStream(file); let got = 0, last = 0;
    for await (const chunk of r.body) {
      got += chunk.length;
      if (!ws.write(chunk)) await new Promise(res => ws.once("drain", res));
      if (total && Date.now() - last > 2000) { last = Date.now(); onProgress(got / total); }
    }
    await new Promise((res, rej) => ws.end(err => err ? rej(err) : res()));
    const head = Buffer.alloc(16), fd = fs.openSync(file, "r"); fs.readSync(fd, head, 0, 16, 0); fs.closeSync(fd);
    if (!head.includes("OSMHeader")) throw new Error("not a map file");
    console.log("downloaded", url, Math.round(got / 1048576) + " MB");
  } finally { clearTimeout(tm); }
}
async function elementsFromPbf(code, c, job) {
  const list = (c.pbf ? [].concat(c.pbf) : []).concat(PBF_SOURCES[code] || []);
  if (!list.length) return null;
  const kx = Math.cos(c.lat * Math.PI / 180) * 111320, kz = 110540, R = HALF + 400;
  const box = { w: c.lon - R / kx, e: c.lon + R / kx, s: c.lat - R / kz, n: c.lat + R / kz };
  const dl = path.join(CACHE, "_download"); fs.mkdirSync(dl, { recursive: true });
  const file = path.join(dl, code + ".osm.pbf");
  for (const url of list) {
    try {
      if (!fs.existsSync(file + ".ok")) {
        console.log(code, "downloading map file", url);
        await download(url, file, f => { job.progress = f * 0.6; });
        fs.writeFileSync(file + ".ok", url);
      }
      console.log(code, "reading map file");
      const els = readPbf(file, box, f => { job.progress = 0.6 + f * 0.32; });
      console.log(code, "map file elements", els.length);
      if (els.length < 100) throw new Error("city area not found in map file");
      fs.rmSync(file, { force: true }); fs.rmSync(file + ".ok", { force: true });
      return els;
    } catch (e) {
      console.log(code, "map file failed", url, e.message);
      fs.rmSync(file, { force: true }); fs.rmSync(file + ".ok", { force: true });
    }
  }
  return null;
}
async function buildCity(code) {
  const c = CITIES[code]; if (!c) throw new Error("unknown city " + code);
  const job = jobs[code] = { progress: 0, started: Date.now() };
  let elements = await elementsFromPbf(code, c, job);
  if (!elements) {
    console.log(code, "using Overpass servers");
    elements = [];
    const kx = Math.cos(c.lat * Math.PI / 180) * 111320, kz = 110540, step = (HALF * 2) / BLOCKS, pad = 60;
    const seen = new Set();
    for (let i = 0; i < BLOCKS; i++) for (let j = 0; j < BLOCKS; j++) {
      const x1 = -HALF + i * step - pad, x2 = -HALF + (i + 1) * step + pad, z1 = -HALF + j * step - pad, z2 = -HALF + (j + 1) * step + pad;
      const b = { w: c.lon + x1 / kx, e: c.lon + x2 / kx, n: c.lat - z1 / kz, s: c.lat - z2 / kz };
      const els = await fetchArea(code, b, 0, "b" + i + j);
      for (const el of els) { const k = el.type[0] + el.id; if (!seen.has(k)) { seen.add(k); elements.push(el); } }
      job.progress = (i * BLOCKS + j + 1) / (BLOCKS * BLOCKS) * 0.92;
      console.log(code, "block", i, j, "elements", elements.length);
      await sleep(1500);
    }
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
