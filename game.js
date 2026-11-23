(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  var D2R = Math.PI / 180;
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6d2b79f5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }

  /* ================= Clock ================= */
  var clk = store.get("pw2_clock", { offset: 0, speed: 1, base: Date.now() });
  function now() { var r = Date.now(); return r + clk.offset + (r - clk.base) * (clk.speed - 1); }
  function setSpeed(s) { var n = now(); clk.base = Date.now(); clk.offset = n - clk.base; clk.speed = s; store.set("pw2_clock", clk); }

  /* ================= Airports ================= */
  var AP = [
    ["JFK","New York","United States",40.6413,-73.7781,"America/New_York","John F. Kennedy International"],
    ["LAX","Los Angeles","United States",33.9416,-118.4085,"America/Los_Angeles","Los Angeles International"],
    ["ORD","Chicago","United States",41.9742,-87.9073,"America/Chicago","O'Hare International"],
    ["ATL","Atlanta","United States",33.6407,-84.4277,"America/New_York","Hartsfield-Jackson International"],
    ["SFO","San Francisco","United States",37.6213,-122.379,"America/Los_Angeles","San Francisco International"],
    ["MIA","Miami","United States",25.7959,-80.287,"America/New_York","Miami International"],
    ["LAS","Las Vegas","United States",36.084,-115.1537,"America/Los_Angeles","Harry Reid International"],
    ["SEA","Seattle","United States",47.4502,-122.3088,"America/Los_Angeles","Seattle-Tacoma International"],
    ["YYZ","Toronto","Canada",43.6777,-79.6248,"America/Toronto","Toronto Pearson International"],
    ["MEX","Mexico City","Mexico",19.4361,-99.0719,"America/Mexico_City","Benito Ju\u00e1rez International"],
    ["GRU","S\u00e3o Paulo","Brazil",-23.4356,-46.4731,"America/Sao_Paulo","Guarulhos International"],
    ["LHR","London","United Kingdom",51.47,-0.4543,"Europe/London","London Heathrow"],
    ["CDG","Paris","France",49.0097,2.5479,"Europe/Paris","Paris Charles de Gaulle"],
    ["FRA","Frankfurt","Germany",50.0379,8.5622,"Europe/Berlin","Frankfurt am Main"],
    ["MAD","Madrid","Spain",40.4983,-3.5676,"Europe/Madrid","Adolfo Su\u00e1rez Madrid-Barajas"],
    ["FCO","Rome","Italy",41.8003,12.2389,"Europe/Rome","Rome Fiumicino"],
    ["IST","Istanbul","Turkey",41.2753,28.7519,"Europe/Istanbul","Istanbul Airport"],
    ["CAI","Cairo","Egypt",30.1219,31.4056,"Africa/Cairo","Cairo International"],
    ["JNB","Johannesburg","South Africa",-26.1392,28.246,"Africa/Johannesburg","O. R. Tambo International"],
    ["LOS","Lagos","Nigeria",6.5774,3.3212,"Africa/Lagos","Murtala Muhammed International"],
    ["DXB","Dubai","United Arab Emirates",25.2532,55.3657,"Asia/Dubai","Dubai International"],
    ["DOH","Doha","Qatar",25.2731,51.6081,"Asia/Qatar","Hamad International"],
    ["DEL","Delhi","India",28.5562,77.1,"Asia/Kolkata","Indira Gandhi International"],
    ["DAC","Dhaka","Bangladesh",23.8433,90.3978,"Asia/Dhaka","Hazrat Shahjalal International"],
    ["BKK","Bangkok","Thailand",13.69,100.7501,"Asia/Bangkok","Suvarnabhumi"],
    ["SIN","Singapore","Singapore",1.3644,103.9915,"Asia/Singapore","Singapore Changi"],
    ["HKG","Hong Kong","Hong Kong",22.308,113.9185,"Asia/Hong_Kong","Hong Kong International"],
    ["PEK","Beijing","China",40.0799,116.6031,"Asia/Shanghai","Beijing Capital International"],
    ["ICN","Seoul","South Korea",37.4602,126.4407,"Asia/Seoul","Incheon International"],
    ["NRT","Tokyo","Japan",35.772,140.3929,"Asia/Tokyo","Tokyo Narita"],
    ["SYD","Sydney","Australia",-33.9399,151.1753,"Australia/Sydney","Sydney Kingsford Smith"]
  ].map(function (a) { return { code: a[0], city: a[1], country: a[2], lat: a[3], lon: a[4], tz: a[5], name: a[6], us: a[2] === "United States" }; });
  var AIR = {}; AP.forEach(function (a) { AIR[a.code] = a; });
  function distKm(a, b) {
    var p1 = a.lat * D2R, p2 = b.lat * D2R, dp = p2 - p1, dl = (b.lon - a.lon) * D2R;
    var h = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
    return 2 * 6371 * Math.asin(Math.sqrt(h));
  }
  function flightMs(a, b) { return Math.round((distKm(a, b) / 850 + 0.5) * 3600000); }
  function fmtT(ms, tz) { try { return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: tz }).format(ms); } catch (e) { return new Date(ms).toISOString().slice(11, 16); } }
  function fmtD(ms, tz) { try { return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "2-digit", month: "short", timeZone: tz }).format(ms); } catch (e) { return ""; } }
  function localHour(ms, tz) { try { var p = new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "numeric", hourCycle: "h23", timeZone: tz }).formatToParts(ms); var h = 0, m = 0; p.forEach(function (x) { if (x.type === "hour") h = +x.value; if (x.type === "minute") m = +x.value; }); return h + m / 60; } catch (e) { return new Date(ms).getHours(); } }
  function dur(ms) { ms = Math.max(0, ms); var h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60; return h ? h + "h " + String(m).padStart(2, "0") + "m" : m + "m " + String(s).padStart(2, "0") + "s"; }

  /* ================= State ================= */
  var LEG = "#b8860b", EPI = "#7b4fd6", RAR = "#2f6fd6", COM = "#4b5568";
  var JOBS = [
    ["Oil Field Owner","Legendary",1,LEG,140],["Gold Mine Owner","Legendary",1,LEG,140],["Company Owner","Legendary",1.2,LEG,130],["Bank Owner","Legendary",0.8,LEG,135],
    ["Factory Owner","Epic",2,EPI,90],["Airline Pilot","Epic",2,EPI,95],["Doctor","Epic",2,EPI,95],["Hotel Owner","Epic",1.5,EPI,90],["Tech Founder","Epic",1.5,EPI,92],
    ["Real Estate Agent","Rare",3,RAR,60],["Restaurant Owner","Rare",3,RAR,60],["Grocery Store Owner","Rare",3,RAR,55],["Farm Owner","Rare",3,RAR,55],
    ["Software Engineer","Rare",3,RAR,62],["Lawyer","Rare",2.5,RAR,62],["Nurse","Rare",3,RAR,55],["Banker","Rare",2.5,RAR,58],
    ["Taxi Driver","Common",5,COM,35],["Truck Driver","Common",4,COM,35],["Delivery Driver","Common",4,COM,32],["Farmer","Common",5,COM,30],["Miner","Common",5,COM,32],
    ["Oil Rig Worker","Common",4,COM,34],["Factory Worker","Common",4,COM,30],["Construction Worker","Common",5,COM,32],["Chef","Common",4,COM,30],
    ["Shop Assistant","Common",4,COM,28],["Mechanic","Common",4,COM,30],["Teacher","Common",4,COM,32],["Barista","Common",4,COM,28],
    ["Hotel Receptionist","Common",4,COM,28],["Security Guard","Common",4,COM,30]
  ];
  var FIRST = ["James","Olivia","Liam","Emma","Noah","Ava","Mason","Sophia","Ethan","Mia","Lucas","Amelia","Logan","Harper","Elijah","Evelyn","Caleb","Ella","Jordan","Maya","Ryan","Zoe","Nathan","Layla","Isaac","Nora","Owen","Riley"];
  var LAST = ["Carter","Brooks","Hayes","Reed","Morgan","Bennett","Foster","Rivera","Coleman","Price","Hughes","Ward","Bryant","Russell","Griffin","Diaz","Hunt","Palmer","Stone","Fisher","Wells","Porter","Knight","Lane","Grant","Shaw","Ross","Pierce"];
  function makePassport(id) {
    var r = rng(id * 2654435761 + 17), roll = r() * 100, acc = 0, job = JOBS[JOBS.length - 1];
    for (var i = 0; i < JOBS.length; i++) { acc += JOBS[i][2]; if (roll < acc) { job = JOBS[i]; break; } }
    var y = 1966 + Math.floor(r() * 38), m = 1 + Math.floor(r() * 12), d = 1 + Math.floor(r() * 28);
    return { id: id, first: FIRST[Math.floor(r() * FIRST.length)], last: LAST[Math.floor(r() * LAST.length)], sex: r() < 0.5 ? "F" : "M", dob: [y, m, d], no: "PW" + String(1000000 + Math.floor(r() * 8999999)), job: job,
      skin: ["#f1c9a5", "#e0ac83", "#c68a5e", "#9a6440", "#6e452b"][Math.floor(r() * 5)], hair: ["#1f1a17", "#4a2f1f", "#8a5a2b", "#c99a4a", "#6b6b6b"][Math.floor(r() * 5)], suit: ["#1f2a44", "#3a3f4b", "#5a2e2e", "#2e4a3a", "#2f3e66"][Math.floor(r() * 5)], style: Math.floor(r() * 3) };
  }
  var G = store.get("pw2_state", null);
  if (!G || !G.passport) {
    G = { city: "JFK", balance: 600, food: 80, foodT: now(), trip: null, flags: {}, stamps: [], passport: makePassport(1 + Math.floor(Math.random() * 3333)), arrival: false };
  }
  function save() { store.set("pw2_state", G); }
  if (!G.tx) G.tx = []; if (!G.msgs) G.msgs = []; if (!G.done) G.done = {};
  function logTx(amt, label) { G.tx.unshift({ a: amt, l: label, t: now(), c: G.city }); if (G.tx.length > 60) G.tx.length = 60; }
  function earn(amt, label) { G.balance += amt; logTx(amt, label); save(); }
  function spend(amt, label) { G.balance -= amt; logTx(-amt, label); save(); }
  function here() { return AIR[G.city] || AIR.JFK; }

  /* ================= Renderer ================= */
  var canvas = $("gl");
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: "high-performance" });
  var DPR = Math.min(window.devicePixelRatio || 1, 1.75);
  renderer.setPixelRatio(DPR);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.78;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(52, 1, 0.1, 2200);
  scene.fog = new THREE.Fog(0xbfd3e6, 140, 700);

  var skyU = { top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, bot: { value: new THREE.Color() } };
  var sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
    vertexShader: "varying vec3 vP; void main(){ vP=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }",
    fragmentShader: "uniform vec3 top; uniform vec3 mid; uniform vec3 bot; varying vec3 vP; void main(){ float h=vP.y; vec3 c = h>0. ? mix(mid, top, pow(h,0.55)) : mix(mid, bot, pow(-h,0.4)); gl_FragColor=vec4(c,1.); }"
  }));
  scene.add(sky);
  var hemi = new THREE.HemisphereLight(0xdfeeff, 0x6b6150, 0.9); scene.add(hemi);
  var pmrem = new THREE.PMREMGenerator(renderer);
  if (THREE.RoomEnvironment) scene.environment = pmrem.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
  var sun = new THREE.DirectionalLight(0xfff1dc, 1.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  var sc = sun.shadow.camera; sc.left = -48; sc.right = 48; sc.top = 48; sc.bottom = -48; sc.near = 1; sc.far = 260;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  scene.add(sun); scene.add(sun.target);

  /* ================= Materials & textures ================= */
  function canvasTex(w, h, draw, repeat) {
    var c = document.createElement("canvas"); c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    var t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
    return t;
  }
  var nightMats = [];
  function facade(kind, seed) {
    var r = rng(seed), base, frame, glass;
    if (kind === "glass") { base = "#20343a"; frame = "#9fb3b6"; glass = ["#2f5560", "#3c6773", "#284650"]; }
    else if (kind === "brick") { base = "#7a4434"; frame = "#e8e0d2"; glass = ["#24323b", "#2c3d47", "#1f2b33"]; }
    else if (kind === "stone") { base = "#d8cfbd"; frame = "#7d7462"; glass = ["#2a3a44", "#33454f", "#263540"]; }
    else { base = "#b9bcbd"; frame = "#58606a"; glass = ["#2b3a46", "#35485a", "#22303b"]; }
    var lit = [];
    var map = canvasTex(256, 256, function (g, w, h) {
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      var cols = 4, rows = 4, cw = w / cols, rh = h / rows;
      for (var y = 0; y < rows; y++) for (var x = 0; x < cols; x++) {
        var px = x * cw, py = y * rh;
        if (kind === "glass") {
          g.fillStyle = glass[Math.floor(r() * 3)]; g.fillRect(px + 2, py + 2, cw - 4, rh - 4);
          g.fillStyle = "rgba(255,255,255,0.08)"; g.fillRect(px + 2, py + 2, cw - 4, (rh - 4) * 0.35);
          g.fillStyle = frame; g.fillRect(px, py + rh - 6, cw, 6);
        } else {
          g.fillStyle = frame; g.fillRect(px + 10, py + 12, cw - 20, rh - 22);
          g.fillStyle = glass[Math.floor(r() * 3)]; g.fillRect(px + 14, py + 16, cw - 28, rh - 30);
          g.fillStyle = "rgba(255,255,255,0.12)"; g.fillRect(px + 14, py + 16, cw - 28, 6);
          g.fillStyle = "rgba(0,0,0,0.18)"; g.fillRect(px + 10, py + rh - 10, cw - 20, 3);
        }
        lit.push(r() < 0.42);
      }
      if (kind === "brick") { g.fillStyle = "rgba(0,0,0,0.07)"; for (var k = 0; k < h; k += 6) g.fillRect(0, k, w, 1); }
    }, true);
    var emis = canvasTex(256, 256, function (g, w, h) {
      g.fillStyle = "#000"; g.fillRect(0, 0, w, h);
      var cw = w / 4, rh = h / 4, i = 0;
      for (var y = 0; y < 4; y++) for (var x = 0; x < 4; x++, i++) if (lit[i]) {
        g.fillStyle = ["#ffd9a0", "#fff1cf", "#cfe6ff"][i % 3];
        if (kind === "glass") g.fillRect(x * cw + 2, y * rh + 2, cw - 4, rh - 8); else g.fillRect(x * cw + 14, y * rh + 16, cw - 28, rh - 30);
      }
    }, true);
    var mat = new THREE.MeshStandardMaterial({ map: map, emissiveMap: emis, emissive: new THREE.Color(0xffffff), emissiveIntensity: 0, roughness: kind === "glass" ? 0.25 : 0.85, metalness: kind === "glass" ? 0.4 : 0.05 });
    nightMats.push(mat);
    return mat;
  }
  var M = {
    asphalt: new THREE.MeshStandardMaterial({ color: 0x232529, roughness: 0.88 }),
    tarmac: new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.95 }),
    walk: new THREE.MeshStandardMaterial({ color: 0x8f8b82, roughness: 0.9 }),
    curb: new THREE.MeshStandardMaterial({ color: 0x6d6a64, roughness: 0.9 }),
    grass: new THREE.MeshStandardMaterial({ color: 0x46612f, roughness: 1 }),
    white: new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.5 }),
    yellow: new THREE.MeshStandardMaterial({ color: 0xf2c230, roughness: 0.6 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1c1f22, roughness: 0.6, metalness: 0.3 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.35, metalness: 0.8 }),
    floor: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.22, metalness: 0.05 }),
    shopFloor: new THREE.MeshStandardMaterial({ color: 0xd9d3c7, roughness: 0.4 }),
    wall: new THREE.MeshStandardMaterial({ color: 0xcfcac0, roughness: 0.8 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x9fd3d8, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.22, depthWrite: false }),
    neon: new THREE.MeshStandardMaterial({ color: 0xccff00, emissive: 0xccff00, emissiveIntensity: 0.6, roughness: 0.4 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x8a6040, roughness: 0.7 }),
    counter: new THREE.MeshStandardMaterial({ color: 0x24282b, roughness: 0.35, metalness: 0.2 }),
    seat: new THREE.MeshStandardMaterial({ color: 0x2b3440, roughness: 0.6 }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x4f7a33, roughness: 0.9, flatShading: true }),
    trunk: new THREE.MeshStandardMaterial({ color: 0x5a4030, roughness: 0.9 }),
    bulb: new THREE.MeshStandardMaterial({ color: 0xfff4d6, emissive: 0xffe2a8, emissiveIntensity: 0, roughness: 0.3 })
  };
  M.floor.map = canvasTex(512, 512, function (g, w, h) { g.fillStyle = '#a9a49a'; g.fillRect(0, 0, w, h); var r = rng(4); for (var y = 0; y < 4; y++) for (var x = 0; x < 4; x++) { var v = 160 + Math.floor(r() * 22); g.fillStyle = 'rgb(' + v + ',' + (v - 4) + ',' + (v - 12) + ')'; g.fillRect(x * 128 + 2, y * 128 + 2, 124, 124); } }, true);
  M.floor.map.repeat.set(40, 30);
  M.shopFloor.map = M.floor.map;

  function box(w, h, d, mat, x, y, z, opts) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    if (!opts || opts.shadow !== false) { m.castShadow = true; m.receiveShadow = true; }
    scene.add(m);
    return m;
  }
  function plane(w, d, mat, x, y, z) {
    var m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true; scene.add(m); return m;
  }
  function signTex(text, opt) {
    opt = opt || {};
    var w = opt.w || 1024, h = opt.h || 192;
    return canvasTex(w, h, function (g) {
      g.fillStyle = opt.bg || "#0b0d0b"; g.fillRect(0, 0, w, h);
      if (opt.bar) { g.fillStyle = opt.bar; g.fillRect(0, h - 12, w, 12); }
      g.fillStyle = opt.fg || "#ccff00";
      var size = opt.size || 86;
      g.font = (opt.weight || 800) + " " + size + "px Unbounded, 'Arial Black', sans-serif";
      while (g.measureText(text).width > w * 0.9 && size > 20) { size -= 4; g.font = (opt.weight || 800) + " " + size + "px Unbounded, 'Arial Black', sans-serif"; }
      g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(text, w / 2, h / 2 + (opt.sub ? -size * 0.25 : 2));
      if (opt.sub) { g.font = "600 " + Math.round(size * 0.36) + "px 'JetBrains Mono', monospace"; g.fillStyle = opt.subfg || "#ffffff"; g.fillText(opt.sub, w / 2, h / 2 + size * 0.5); }
    });
  }
  var dynSigns = [];
  function sign(textFn, wid, hei, x, y, z, ry, opt) {
    var mat = new THREE.MeshStandardMaterial({ map: signTex(typeof textFn === "function" ? textFn() : textFn, opt), emissive: new THREE.Color(0xffffff), emissiveIntensity: 0.25, roughness: 0.5 });
    mat.emissiveMap = mat.map;
    var m = new THREE.Mesh(new THREE.PlaneGeometry(wid, hei), mat);
    m.position.set(x, y, z); m.rotation.y = ry || 0; scene.add(m);
    if (typeof textFn === "function") dynSigns.push({ m: m, fn: textFn, opt: opt });
    nightMats.push(mat);
    return m;
  }
  function refreshSigns() {
    dynSigns.forEach(function (s) { var t = signTex(s.fn(), s.opt); s.m.material.map.dispose(); s.m.material.map = t; s.m.material.emissiveMap = t; s.m.material.needsUpdate = true; });
  }

  /* ================= Collision ================= */
  var COL = [], MAPB = [];
  function solid(x1, x2, z1, z2, tag) { var c = { x1: Math.min(x1, x2), x2: Math.max(x1, x2), z1: Math.min(z1, z2), z2: Math.max(z1, z2), on: true, tag: tag || "" }; COL.push(c); return c; }
  function collide(p, r) {
    for (var i = 0; i < COL.length; i++) {
      var c = COL[i]; if (!c.on) continue;
      var cx = clamp(p.x, c.x1, c.x2), cz = clamp(p.z, c.z1, c.z2), dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 1e-8) { var d = Math.sqrt(d2), k = (r - d) / d; p.x += dx * k; p.z += dz * k; }
        else {
          var l = p.x - c.x1, rr = c.x2 - p.x, t = p.z - c.z1, b = c.z2 - p.z, mn = Math.min(l, rr, t, b);
          if (mn === l) p.x = c.x1 - r; else if (mn === rr) p.x = c.x2 + r; else if (mn === t) p.z = c.z1 - r; else p.z = c.z2 + r;
        }
      }
    }
  }

  /* ================= Interiors (fade when inside) ================= */
  var ROOMS = [];
  function room(x1, x2, z1, z2, meshes) { var r = { x1: x1, x2: x2, z1: z1, z2: z2, meshes: meshes, inside: false }; ROOMS.push(r); return r; }
  function fadeMesh(m, a) {
    if (!m.userData.mat0) { m.userData.mat0 = m.material; m.userData.matF = m.material.clone(); m.userData.matF.transparent = true; m.userData.matF.depthWrite = false; }
    if (a >= 0.999) { m.material = m.userData.mat0; m.castShadow = m.userData.cs !== undefined ? m.userData.cs : m.castShadow; }
    else { m.userData.matF.opacity = a; m.material = m.userData.matF; }
  }

  var NPCS = [], ZONES = [], CITY = null;
  /* ================= City style: each city looks different ================= */
  var CS = (function () {
    var EU = ["stone", "stone", "brick", "stone"], US = ["glass", "brick", "stone", "concrete", "glass"], ASIA = ["glass", "glass", "concrete", "glass"], DES = ["stone", "concrete", "glass", "stone"];
    var T = {
      JFK: [1.45, US, "spire", "City Spire", "BROADWAY"], ORD: [1.3, US, "spire", "Lakeside Spire", "MICHIGAN AVE"], ATL: [1.1, US, "spire", "Peach Tower", "PEACHTREE ST"],
      LAX: [0.8, US, "dome", "Hilltop Observatory", "SUNSET BLVD"], SFO: [1.0, US, "gate", "Bay Bridge Tower", "MARKET ST"], MIA: [0.9, US, "lighthouse", "Ocean Lighthouse", "OCEAN DRIVE"],
      LAS: [0.9, US, "needle", "Desert Needle", "THE STRIP"], SEA: [1.0, US, "needle", "Sky Needle", "PIKE ST"], YYZ: [1.2, US, "needle", "Lake Tower", "YONGE ST"],
      MEX: [0.8, DES, "column", "Golden Angel Column", "REFORMA AVE"], GRU: [1.1, US, "column", "Liberty Column", "PAULISTA AVE"],
      LHR: [0.75, EU, "clock", "Clock Tower", "OXFORD ST"], CDG: [0.55, EU, "lattice", "Iron Tower", "CHAMPS AVE"], FRA: [1.15, ["glass", "stone", "glass"], "twin", "Twin Bank Towers", "MAIN QUAY"],
      MAD: [0.65, EU, "arch", "Royal Gate", "GRAN VIA"], FCO: [0.5, EU, "arena", "Old Arena", "VIA ROMA"], IST: [0.7, EU, "dome", "Grand Dome", "BOSPHORUS AVE"],
      CAI: [0.6, DES, "pyramid", "Great Pyramid", "NILE CORNICHE"], JNB: [1.0, US, "needle", "Hill Tower", "COMMISSIONER ST"], LOS: [0.85, DES, "column", "Unity Column", "MARINA RD"],
      DXB: [1.6, ["glass", "glass", "stone"], "supertall", "Sky Tower", "SHEIKH ZAYED RD"], DOH: [1.25, ["glass", "stone", "glass"], "supertall", "Pearl Tower", "CORNICHE ST"],
      DEL: [0.7, DES, "arch", "Victory Gate", "RAJPATH"], DAC: [0.85, ["concrete", "brick", "stone"], "arch", "Martyrs Arch", "MIRPUR RD"],
      BKK: [1.05, ASIA, "pagoda", "Golden Pagoda", "SUKHUMVIT RD"], SIN: [1.3, ASIA, "trio", "Marina Trio", "ORCHARD RD"], HKG: [1.55, ASIA, "twin", "Harbour Twins", "NATHAN RD"],
      PEK: [0.95, ASIA, "pagoda", "Temple of Heaven", "CHANG'AN AVE"], ICN: [1.15, ASIA, "needle", "Hill Tower", "GANGNAM-DAERO"], NRT: [1.15, ASIA, "lattice", "Red Tower", "GINZA DORI"],
      SYD: [1.0, US, "sails", "Harbour Sails", "GEORGE ST"]
    };
    var c = (AIR[G.city] || AIR.JFK).code, d = T[c] || T.JFK;
    return { hm: d[0], kinds: d[1], lm: d[2], lmName: d[3], street: d[4], seed: hash(c) };
  })();
  /* ================= World: city ================= */
  var CITY_X1 = -150, CITY_X2 = 66;
  plane(1400, 1400, M.grass, 200, -0.02, 0);
  plane(CITY_X2 - CITY_X1 + 60, 14, M.asphalt, (CITY_X1 + CITY_X2) / 2 - 20, 0, 0);
  var laneTex = canvasTex(512, 64, function (g, w, h) {
    g.clearRect(0, 0, w, h);
    g.fillStyle = "#f3c63a"; g.fillRect(0, 29, w, 3); g.fillRect(0, 34, w, 3);
  }, true);
  laneTex.repeat.set(30, 1);
  var lane = plane(CITY_X2 - CITY_X1 + 60, 1.2, new THREE.MeshStandardMaterial({ map: laneTex, transparent: true, roughness: 0.9 }), (CITY_X1 + CITY_X2) / 2 - 20, 0.012, 0);
  var dashTex = canvasTex(256, 16, function (g, w, h) { g.clearRect(0, 0, w, h); g.fillStyle = "#e9e9e3"; g.fillRect(0, 5, w * 0.45, 6); }, true);
  dashTex.repeat.set(60, 1);
  [-3.6, 3.6].forEach(function (z) { var d = plane(CITY_X2 - CITY_X1 + 60, 0.25, new THREE.MeshStandardMaterial({ map: dashTex, transparent: true }), (CITY_X1 + CITY_X2) / 2 - 20, 0.013, z); });
  [[-25], [20]].forEach(function (cw) {
    for (var k = -5; k <= 5; k += 1.25) { var s = plane(3, 0.6, M.white, cw[0], 0.014, k); }
  });
  [-1, 1].forEach(function (sgn) {
    box(CITY_X2 - CITY_X1 + 60, 0.16, 4.2, M.walk, (CITY_X1 + CITY_X2) / 2 - 20, 0.08, sgn * 9.1, { shadow: false }).receiveShadow = true;
    box(CITY_X2 - CITY_X1 + 60, 0.18, 0.25, M.curb, (CITY_X1 + CITY_X2) / 2 - 20, 0.09, sgn * 7.05, { shadow: false }).receiveShadow = true;
  });

  var lampGeo = new THREE.CylinderGeometry(0.07, 0.1, 6, 8), armGeo = new THREE.BoxGeometry(1.4, 0.08, 0.08), headGeo = new THREE.BoxGeometry(0.5, 0.12, 0.28), poolTex = canvasTex(128, 128, function (g, w, h) { var gr = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2); gr.addColorStop(0, "rgba(255,214,150,0.85)"); gr.addColorStop(1, "rgba(255,214,150,0)"); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  var poolMat = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false, opacity: 0, blending: THREE.AdditiveBlending });
  for (var lx = CITY_X1 + 6; lx < CITY_X2 - 4; lx += 22) {
    [-1, 1].forEach(function (sgn) {
      var z = sgn * 7.6;
      var pole = new THREE.Mesh(lampGeo, M.dark); pole.position.set(lx, 3, z); pole.castShadow = true; scene.add(pole);
      var arm = new THREE.Mesh(armGeo, M.dark); arm.position.set(lx, 5.95, z - sgn * 0.6); arm.rotation.y = Math.PI / 2; scene.add(arm);
      var hd = new THREE.Mesh(headGeo, M.bulb); hd.position.set(lx, 5.88, z - sgn * 1.2); hd.rotation.y = Math.PI / 2; scene.add(hd);
      var pool = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), poolMat); pool.rotation.x = -Math.PI / 2; pool.position.set(lx, 0.03, z - sgn * 1.6); scene.add(pool);
      solid(lx - 0.15, lx + 0.15, z - 0.15, z + 0.15);
    });
  }
  function tree(x, z, s) {
    var t = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * s, 0.18 * s, 2.4 * s, 6), M.trunk); t.position.set(x, 1.2 * s, z); t.castShadow = true; scene.add(t);
    var c = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5 * s, 1), M.leaf); c.position.set(x, 3.2 * s, z); c.castShadow = true; scene.add(c);
    var c2 = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1 * s, 1), M.leaf); c2.position.set(x + 0.6 * s, 3.9 * s, z + 0.3 * s); c2.castShadow = true; scene.add(c2);
    box(1.3, 0.35, 1.3, M.curb, x, 0.25, z, { shadow: false });
    solid(x - 0.65, x + 0.65, z - 0.65, z + 0.65);
  }
  for (var tx = CITY_X1 + 17; tx < CITY_X2 - 4; tx += 22) { tree(tx, -9.8, 1); tree(tx + 4, 9.8, 0.95); }

  function building(x1, x2, z1, z2, h, kind, seed) {
    return null;
    if (seed !== 23 && seed !== 31) { var br = rng(seed * 7 + CS.seed); kind = CS.kinds[Math.floor(br() * CS.kinds.length)]; h = clamp(h * CS.hm * (0.75 + br() * 0.5), 9, 120); }
    else h = clamp(h * (0.7 + CS.hm * 0.3), 12, 90);
    var w = x2 - x1, d = z2 - z1, mat = facade(kind, seed + CS.seed % 50);
    var geo = new THREE.BoxGeometry(w, h, d);
    var uv = geo.attributes.uv, pos = geo.attributes.position, nor = geo.attributes.normal;
    for (var i = 0; i < uv.count; i++) {
      var nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i));
      if (ny > 0.5) { uv.setXY(i, 0.02, 0.02); continue; }
      var horiz = nx > 0.5 ? pos.getZ(i) + d / 2 : pos.getX(i) + w / 2;
      uv.setXY(i, horiz / 12, (pos.getY(i) + h / 2) / 14);
    }
    var m = new THREE.Mesh(geo, mat); m.position.set((x1 + x2) / 2, h / 2, (z1 + z2) / 2); m.castShadow = true; m.receiveShadow = true; scene.add(m);
    box(w + 0.6, 0.5, d + 0.6, M.dark, (x1 + x2) / 2, h + 0.25, (z1 + z2) / 2);
    solid(x1, x2, z1, z2, "bld");
    MAPB.push({ x1: x1, x2: x2, z1: z1, z2: z2, k: kind });
    return m;
  }
  building(-150, -118, -32, -11.2, 22, "brick", 3);
  building(-150, -120, 11.2, 34, 30, "stone", 5);
  building(-116, -84, 11.2, 30, 18, "brick", 7);
  building(-46, -20, 11.2, 34, 38, "glass", 9);
  building(12, 38, 11.2, 34, 52, "glass", 13);
  building(-16, 4, -30, -11.2, 26, "concrete", 17);
  building(8, 30, -34, -11.2, 44, "brick", 19);
  building(34, 62, -30, -11.2, 16, "stone", 21);

  /* City hall / land office */
  (function () {
    var x1 = -116, x2 = -84, z2 = -11.2, z1 = -36;
    building(x1, x2, z1, z2 - 4, 16, "stone", 23);
    for (var i = 0; i < 6; i++) { var c = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.6, 10, 16), M.white); c.position.set(x1 + 4 + i * 4.8, 5, z2 - 1.6); c.castShadow = true; scene.add(c); solid(c.position.x - 0.6, c.position.x + 0.6, z2 - 2.2, z2 - 1); }
    box(x2 - x1, 1.4, 4, M.white, (x1 + x2) / 2, 10.7, z2 - 1.8);
    for (var s = 0; s < 3; s++) box(x2 - x1 - 2, 0.2, 1.2 - s * 0.3, M.walk, (x1 + x2) / 2, 0.1 + s * 0.2, z2 - 0.2 - s * 0.3, { shadow: false });
    sign("CITY HALL", 16, 2, (x1 + x2) / 2, 12.4, z2 - 3.79, 0, { bg: "#f2efe6", fg: "#1a1d1a", size: 92, w: 1024, h: 128 });
  })();

  /* Enterable shops */
  function shop(x1, x2, depth, h, title, sub, color, interior) {
    return;
    var z2 = -11.2, z1 = z2 - depth, w = x2 - x1, cx = (x1 + x2) / 2, t = 0.3, door = 3.2;
    MAPB.push({ x1: x1, x2: x2, z1: z1, z2: z2, k: "shop" });
    var wallMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.75 });
    var ms = [];
    ms.push(box(w, h, t, wallMat, cx, h / 2, z1));
    ms.push(box(t, h, depth, wallMat, x1, h / 2, z1 + depth / 2));
    ms.push(box(t, h, depth, wallMat, x2, h / 2, z1 + depth / 2));
    var side = (w - door) / 2;
    ms.push(box(side, 1, t, wallMat, x1 + side / 2, 0.5, z2));
    ms.push(box(side, 1, t, wallMat, x2 - side / 2, 0.5, z2));
    ms.push(box(w, h - 3.4, t, wallMat, cx, 3.4 + (h - 3.4) / 2, z2));
    var gl1 = box(side, 2.4, 0.06, M.glass, x1 + side / 2, 2.2, z2, { shadow: false }); ms.push(gl1);
    var gl2 = box(side, 2.4, 0.06, M.glass, x2 - side / 2, 2.2, z2, { shadow: false }); ms.push(gl2);
    var roof = box(w + 0.4, 0.4, depth + 0.4, M.dark, cx, h + 0.2, z1 + depth / 2); ms.push(roof);
    var awn = box(w, 0.15, 1.6, new THREE.MeshStandardMaterial({ color: 0x111411, roughness: 0.6 }), cx, 3.55, z2 + 0.8); ms.push(awn);
    var sg = sign(title, w * 0.8, w * 0.8 * 0.1875, cx, 4.6, z2 + 0.17, 0, { sub: sub, size: 92 }); ms.push(sg);
    plane(w - 0.6, depth - 0.6, M.shopFloor, cx, 0.17, z1 + depth / 2);
    var lamp = new THREE.PointLight(0xfff2d8, 0.8, 22, 2); lamp.position.set(cx, h - 0.8, z1 + depth / 2); scene.add(lamp);
    solid(x1 - t / 2, x2 + t / 2, z1 - t / 2, z1 + t / 2, "bld");
    solid(x1 - t / 2, x1 + t / 2, z1, z2, "bld");
    solid(x2 - t / 2, x2 + t / 2, z1, z2, "bld");
    solid(x1, x1 + side, z2 - t / 2, z2 + t / 2);
    solid(x2 - side, x2, z2 - t / 2, z2 + t / 2);
    if (interior) interior(x1, x2, z1, z2, ms);
    room(x1, x2, z1, z2 + 0.2, ms);
  }
  shop(-80, -60, 16, 6.5, "FRESH MART", "GROCERY  \u00b7  OPEN 24 HOURS", 0xe9e4d8, function (x1, x2, z1, z2, ms) {
    var cx = (x1 + x2) / 2, foods = [0xe0523f, 0xf0c33c, 0x6aa84f, 0x3d85c6, 0xff9f43, 0xffffff];
    for (var r = 0; r < 3; r++) {
      var sx = x1 + 3.5 + r * 5.2, sz = z1 + 7;
      box(1.1, 2, 7, M.white, sx, 1.17, sz); solid(sx - 0.55, sx + 0.55, sz - 3.5, sz + 3.5);
      for (var lv = 0; lv < 3; lv++) for (var k = 0; k < 9; k++) {
        [-1, 1].forEach(function (sd) {
          var it = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 0.6), new THREE.MeshStandardMaterial({ color: foods[(r * 7 + lv * 3 + k + (sd > 0 ? 2 : 0)) % foods.length], roughness: 0.6 }));
          it.position.set(sx + sd * 0.62, 0.6 + lv * 0.6, sz - 3 + k * 0.75); scene.add(it);
        });
      }
    }
    box(4, 1.05, 1.1, M.counter, x2 - 4, 0.7, z2 - 3.4); solid(x2 - 6, x2 - 2, z2 - 3.95, z2 - 2.85);
    box(0.5, 0.35, 0.4, M.dark, x2 - 4.8, 1.4, z2 - 3.4);
    NPCS.push({ kind: "man", x: x2 - 4, z: z2 - 4.6, yaw: 0, tint: 0x2e6b3a, anim: "Idle" });
    ZONES.push({ id: "grocery", x: x2 - 4, z: z2 - 2.1, r: 1.8 });
  });
  shop(-56, -42, 12, 6, "GLOBAL TRAVEL", "VISAS  \u00b7  FLIGHTS  \u00b7  TOURS", 0xdfe5e8, function (x1, x2, z1, z2) {
    var cx = (x1 + x2) / 2;
    box(5, 1.05, 1.1, M.counter, cx, 0.7, z1 + 4); solid(cx - 2.5, cx + 2.5, z1 + 3.45, z1 + 4.55);
    var map = new THREE.Mesh(new THREE.PlaneGeometry(9, 3.6), new THREE.MeshStandardMaterial({ map: signTex("FLY ANYWHERE", { w: 1024, h: 410, bg: "#0b0d0b", sub: "31 AIRPORTS  \u00b7  REAL FLIGHT TIMES", size: 110 }), roughness: 0.6 }));
    map.position.set(cx, 3.2, z1 + 0.2); scene.add(map);
    NPCS.push({ kind: "woman", x: cx, z: z1 + 2.8, yaw: 0, anim: "Idle", tint: 0x3a4d8a });
    ZONES.push({ id: "agency", x: cx, z: z1 + 5.4, r: 1.9 });
  });
  /* Office tower lobby door */
  (function () {
    building(-38, -20, -40, -11.2, 64, "glass", 31);
    box(6, 3.4, 0.2, M.glass, -29, 1.8, -11.05, { shadow: false });
    sign("SUMMIT TOWER", 12, 1.4, -29, 4.6, -11.0, 0, { bg: "#111411", fg: "#ffffff", size: 80, w: 1024, h: 120 });
  })();

  /* Parking + taxi */
  (function () {
    plane(32, 18, M.asphalt, -63, 0.02, 20.2);
    for (var i = 0; i < 6; i++) plane(0.15, 5, M.white, -76 + i * 5.2, 0.03, 16.6);
    sign("TAXI RANK", 6, 0.9, -63, 2.8, 11.6, Math.PI, { bg: "#f2c230", fg: "#111", size: 90, w: 768, h: 116 });
  })();

  /* Tunnel portal at east end of avenue */
  (function () {
    var x = 66;
    box(2, 9, 34, new THREE.MeshStandardMaterial({ color: 0x6f6a62, roughness: 0.9 }), x + 1, 4.5, 0);
    box(4, 5.6, 14, new THREE.MeshBasicMaterial({ color: 0x050505 }), x + 0.2, 2.8, 0, { shadow: false });
    sign("AIRPORT  \u2191  TERMINAL", 12, 1.1, x - 0.01, 7, 0, -Math.PI / 2, { bg: "#0f4d2a", fg: "#ffffff", size: 74, w: 1024, h: 96 });
    solid(x, x + 2, -17, -7); solid(x, x + 2, 7, 17); solid(x - 0.5, x + 2, -7, 7, "tunnel");
  })();

  /* Street name sign */
  sign(function () { return here().city.toUpperCase() + "  \u00b7  " + CS.street; }, 4.5, 0.6, -25, 4.2, 7.3, Math.PI, { bg: "#0f5d36", fg: "#fff", size: 70, w: 768, h: 100 });

  /* ================= World: airport ================= */
  var AX1 = 80, AX2 = 160, AZ = 30, AH = 13;
  var airportLink = { x: 72, z: 0 };
  (function () {
    plane(16, 60, M.walk, 72, 0.04, 0);
    plane(AX2 - AX1, AZ * 2, M.floor, (AX1 + AX2) / 2, 0.05, 0);
    plane(900, 300, M.tarmac, AX2 + 450, 0.02, 0);
    var stripe = canvasTex(512, 32, function (g, w, h) { g.clearRect(0, 0, w, h); g.fillStyle = "#ffffff"; g.fillRect(0, 10, w * 0.5, 12); }, true); stripe.repeat.set(40, 1);
    plane(800, 0.8, new THREE.MeshStandardMaterial({ map: stripe, transparent: true }), AX2 + 440, 0.03, 40);
    plane(800, 46, new THREE.MeshStandardMaterial({ color: 0x2b2d31, roughness: 0.95 }), AX2 + 440, 0.025, 40);
    plane(800, 0.6, M.yellow, AX2 + 440, 0.035, 12);
    var shell = [], frameMat = new THREE.MeshStandardMaterial({ color: 0xe9ecee, roughness: 0.4, metalness: 0.3 });
    function gw(w, h, d, x, y, z) { var m = box(w, h, d, M.glass, x, y, z, { shadow: false }); shell.push(m); return m; }
    gw(0.1, AH, 2 * AZ, AX2, AH / 2, 0);
    var sideGap = 5;
    gw(0.1, AH - 3.4, 2 * AZ, AX1, 3.4 + (AH - 3.4) / 2, 0);
    gw(0.1, 3.4, AZ - sideGap, AX1, 1.7, -(AZ + sideGap) / 2);
    gw(0.1, 3.4, AZ - sideGap, AX1, 1.7, (AZ + sideGap) / 2);
    gw(AX2 - AX1, AH, 0.1, (AX1 + AX2) / 2, AH / 2, -AZ);
    gw(AX2 - AX1, AH, 0.1, (AX1 + AX2) / 2, AH / 2, AZ);
    for (var fx = AX1; fx <= AX2; fx += 8) { [-AZ, AZ].forEach(function (z) { shell.push(box(0.35, AH, 0.35, frameMat, fx, AH / 2, z)); }); }
    for (var fz = -AZ; fz <= AZ; fz += 6) { [AX1, AX2].forEach(function (x) { shell.push(box(0.35, AH, 0.35, frameMat, x, AH / 2, fz)); }); }
    var roof = box(AX2 - AX1 + 6, 0.8, 2 * AZ + 6, new THREE.MeshStandardMaterial({ color: 0xdfe3e6, roughness: 0.5, metalness: 0.2 }), (AX1 + AX2) / 2, AH + 0.4, 0); shell.push(roof);
    for (var bx = AX1 + 6; bx < AX2; bx += 10) shell.push(box(0.5, 0.9, 2 * AZ, frameMat, bx, AH - 0.4, 0));
    var canopy = box(14, 0.4, 26, frameMat, AX1 - 7, 6, 0); shell.push(canopy);
    sign(function () { var a = here(); return a.name.toUpperCase(); }, 30, 3.2, AX1 - 0.3, AH - 2.6, 0, -Math.PI / 2, { bg: "#0b0d0b", fg: "#ffffff", size: 78, w: 1500, h: 160, sub: "", bar: "#ccff00" });
    sign(function () { return here().code + "  \u00b7  " + here().city.toUpperCase(); }, 12, 1.4, AX1 - 7, 6.9, -12.8, 0, { size: 80, w: 1024, h: 120 });
    solid(AX1 - 0.1, AX1 + 0.1, -AZ, -sideGap / 2); solid(AX1 - 0.1, AX1 + 0.1, sideGap / 2, AZ);
    solid(AX2 - 0.1, AX2 + 0.1, -AZ, 10); solid(AX2 - 0.1, AX2 + 0.1, 14, AZ);
    solid(AX1, AX2, -AZ - 0.1, -AZ + 0.1); solid(AX1, AX2, AZ - 0.1, AZ + 0.1);
    room(AX1, AX2, -AZ, AZ, shell);
    var lights = [[100, -10], [130, 8], [146, -10]];
    lights.forEach(function (l) { var pl = new THREE.PointLight(0xffffff, 0.6, 60, 2); pl.position.set(l[0], AH - 2, l[1]); scene.add(pl); });

    var guide = new THREE.MeshStandardMaterial({ color: 0xccff00, emissive: 0xccff00, emissiveIntensity: 0.35, roughness: 0.4 });
    plane(AX2 - AX1 - 4, 0.25, guide, (AX1 + AX2) / 2, 0.06, 1.6);
    plane(0.25, 10.4, guide, 156, 0.061, 6.6);
    plane(AX2 - AX1, 7, new THREE.MeshStandardMaterial({ color: 0x1f2a3a, roughness: 0.95 }), (AX1 + AX2) / 2, 0.055, -24);
    /* check-in */
    for (var c = 0; c < 4; c++) {
      var x = 88 + c * 5;
      box(3.6, 1.1, 1.2, M.counter, x, 0.6, -16); box(3.6, 0.06, 1.3, M.neon, x, 1.16, -16, { shadow: false });
      box(1.2, 0.35, 0.9, M.metal, x + 1.9, 0.35, -15.2);
      sign("CHECK-IN " + (c + 1), 3.2, 0.5, x, 2.8, -16.65, 0, { size: 80, w: 768, h: 120 });
    }
    solid(86, 106, -16.6, -15.4);
    sign("CHECK-IN", 10, 1.2, 96, 7.5, -20, 0, { size: 96, w: 1024, h: 124 });
    NPCS.push({ kind: "woman", x: 98, z: -17.0, yaw: 0, anim: "Idle", tint: 0x0f3a6b });
    ZONES.push({ id: "checkin", x: 98, z: -13.8, r: 2.2 });
    /* queue posts */
    for (var q = 0; q < 6; q++) { var p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 8), M.metal); p.position.set(89 + q * 3, 0.55, -11); scene.add(p); }
    box(15, 0.06, 0.04, new THREE.MeshStandardMaterial({ color: 0x1b2a5c }), 96.5, 0.95, -11, { shadow: false });

    /* security */
    var SX = 112;
    box(0.4, 3, AZ - 2.2, M.wall, SX, 1.5, -(AZ + 2.2) / 2); box(0.4, 3, AZ - 2.2, M.wall, SX, 1.5, (AZ + 2.2) / 2);
    solid(SX - 0.2, SX + 0.2, -AZ, -2.2); solid(SX - 0.2, SX + 0.2, 2.2, AZ);
    var archMat = new THREE.MeshStandardMaterial({ color: 0xd8dcdf, roughness: 0.4, metalness: 0.3 });
    box(0.3, 2.4, 0.3, archMat, SX, 1.2, -1.1); box(0.3, 2.4, 0.3, archMat, SX, 1.2, 1.1); box(0.3, 0.3, 2.5, archMat, SX, 2.5, 0);
    scanLight = box(0.05, 0.05, 2.0, M.neon, SX, 2.3, 0, { shadow: false });
    box(4, 0.9, 1, M.dark, SX - 1, 0.45, -3.4); box(1.4, 1.2, 1.2, archMat, SX - 1, 1.2, -3.4);
    solid(SX - 3, SX + 1, -3.9, -2.9);
    sign("SECURITY", 9, 1.1, SX - 0.25, 5, 0, -Math.PI / 2, { size: 96, w: 1024, h: 124 });
    blockSec = solid(SX - 0.25, SX + 0.25, -2.2, 2.2, "security");
    var barMesh = box(0.08, 0.08, 4.2, M.yellow, SX + 0.4, 1, 0, { shadow: false }); blockSec.mesh = barMesh;
    NPCS.push({ kind: "officer", x: SX + 1.6, z: -2.6, yaw: -Math.PI / 2, anim: "Idle" });
    ZONES.push({ id: "security", x: SX - 2, z: 0, r: 2 });

    /* immigration */
    var IX = 128;
    box(0.4, 3, AZ - 2.2, M.wall, IX, 1.5, -(AZ + 2.2) / 2); box(0.4, 3, AZ - 2.2, M.wall, IX, 1.5, (AZ + 2.2) / 2);
    solid(IX - 0.2, IX + 0.2, -AZ, -2.2); solid(IX - 0.2, IX + 0.2, 2.2, AZ);
    for (var bth = -1; bth <= 1; bth += 2) {
      var bz = bth * 4.2;
      box(2.6, 1.3, 2.2, new THREE.MeshStandardMaterial({ color: 0x1a2b4d, roughness: 0.5 }), IX, 0.65, bz);
      box(2.6, 0.9, 0.06, M.glass, IX, 1.75, bz - bth * 1.1, { shadow: false });
    }
    solid(IX - 1.3, IX + 1.3, -5.3, -3.1); solid(IX - 1.3, IX + 1.3, 3.1, 5.3);
    sign("PASSPORT CONTROL", 11, 1.1, IX - 0.25, 5, 0, -Math.PI / 2, { size: 92, w: 1024, h: 110 });
    blockImm = solid(IX - 0.25, IX + 0.25, -2.2, 2.2, "immigration");
    var bar2 = box(0.08, 0.08, 4.2, M.yellow, IX + 0.4, 1, 0, { shadow: false }); blockImm.mesh = bar2;
    NPCS.push({ kind: "officer", x: IX - 0.3, z: -4.05, yaw: 0, anim: "Idle" });
    ZONES.push({ id: "immigration", x: IX - 2.2, z: 0, r: 2 });

    /* gate lounge */
    for (var row = 0; row < 4; row++) for (var sx = 0; sx < 6; sx++) {
      var px = 136 + sx * 2.6, pz = -16 + row * 4.2;
      box(2.2, 0.45, 0.7, M.seat, px, 0.45, pz); box(2.2, 0.7, 0.12, M.seat, px, 0.9, pz - 0.35);
      if (row % 2 === 0) solid(px - 1.1, px + 1.1, pz - 0.45, pz + 0.4);
    }
    sign("GATE B12", 6, 1, 157.5, 5.4, 12, -Math.PI / 2, { size: 100, w: 768, h: 128 });
    boardSign = sign(function () { return G.trip ? G.trip.no + "  \u00b7  " + (AIR[G.trip.to] || here()).city.toUpperCase() : "NO DEPARTURES"; }, 8, 0.9, 157.5, 4.2, 12, -Math.PI / 2, { bg: "#000", fg: "#ffcf5a", size: 72, w: 1024, h: 116 });
    box(0.3, 3, 4, new THREE.MeshStandardMaterial({ color: 0x2b2f36 }), AX2 - 0.4, 1.5, 12);
    ZONES.push({ id: "gate", x: 156, z: 12, r: 2.2 });
    ZONES.push({ id: "exit", x: AX1 + 3, z: 0, r: 2.2 });
    /* jet bridge */
    var jb = new THREE.MeshStandardMaterial({ color: 0xc9ced3, roughness: 0.5, metalness: 0.3 });
    box(22, 2.8, 3.2, jb, AX2 + 11, 4.2, 12);
    box(1.2, 4, 1.2, M.dark, AX2 + 18, 2, 12);
    /* departures board */
    depBoard = new THREE.Mesh(new THREE.PlaneGeometry(8, 4.5), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    depBoard.position.set(104, 5.5, -AZ + 0.2); scene.add(depBoard);
    var bd2 = depBoard.clone(); bd2.position.set(150, 5.5, -AZ + 0.2); scene.add(bd2); depBoard2 = bd2;
  })();
  var scanLight, blockSec, blockImm, boardSign, depBoard, depBoard2;

  scene.traverse(function (o) { if (o.isMesh && o.material && o.material.isMeshStandardMaterial && !o.material.isMeshPhysicalMaterial) o.material.envMapIntensity = o.material === M.floor ? 0.55 : 0.22; });
  /* ================= Airliner (modern wide-body, EarthPass Air livery) ================= */
  function airliner() {
    var g = new THREE.Group();
    var L0 = -21.5, L1 = 19.8, R = 2.05;
    var prof = [];
    for (var i = 0; i <= 60; i++) {
      var t = i / 60, x = L0 + t * (L1 - L0), r;
      if (x < -12) { var k = (x - L0) / (-12 - L0); r = 0.35 + (R - 0.35) * Math.pow(Math.sin(k * Math.PI / 2), 0.9); }
      else if (x > 13) { var k2 = (L1 - x) / (L1 - 13); r = R * Math.pow(k2, 0.42) * (0.98 + 0.02 * k2); }
      else r = R;
      prof.push(new THREE.Vector2(Math.max(0.02, r), x));
    }
    var geo = new THREE.LatheGeometry(prof, 48); geo.rotateZ(-Math.PI / 2);
    var pa = geo.attributes.position;
    for (var v = 0; v < pa.count; v++) { var px = pa.getX(v); if (px < -12) { var up = Math.pow((-12 - px) / (-12 - L0), 1.5) * 1.35; pa.setY(v, pa.getY(v) * (1 - up * 0.18) + up); } if (px > 15) { pa.setY(v, pa.getY(v) - Math.pow((px - 15) / (L1 - 15), 2) * 0.35); } }
    geo.computeVertexNormals();
    var liv = canvasTex(512, 2048, function (c, w, h) {
      c.fillStyle = "#f5f6f3"; c.fillRect(0, 0, w, h);
      c.fillStyle = "#3a3f44"; c.fillRect(w * 0.13, 0, w * 0.24, h);
      [[0.5, 1], [1.0, -1]].forEach(function (sd) {
        var cx = w * sd[0], up = sd[1] > 0 ? 1 : -1;
        var U = function (du) { var u = cx + up * du * w; return u >= w ? u - w : u < 0 ? u + w : u; };
        c.fillStyle = "#ccff00"; c.fillRect(Math.min(U(-0.075), U(-0.06)), h * 0.1, w * 0.015, h * 0.82);
        c.fillStyle = "#1a2230"; for (var y = h * 0.16; y < h * 0.84; y += 15) c.fillRect(Math.min(U(0.022), U(0.052)), y, w * 0.03, 9);
        c.strokeStyle = "rgba(0,0,0,0.35)"; c.lineWidth = 2; [0.18, 0.5, 0.82].forEach(function (d) { c.strokeRect(Math.min(U(-0.012), U(0.062)), h * d, w * 0.074, 34); });
        c.save(); c.translate(U(0.088), h * 0.55); c.rotate(Math.PI / 2); c.textAlign = "center"; c.fillStyle = "#0b0d0b"; c.font = "800 54px Unbounded, Arial Black, sans-serif"; c.fillText("EARTHPASS AIR", 0, up > 0 ? 18 : 18); c.restore();
      });
      c.fillStyle = "#121820"; for (var k = 0; k < 4; k++) { var x0 = w * 0.75 - 46 + k * 23; c.beginPath(); c.moveTo(x0, h * 0.028); c.lineTo(x0 + 20, h * 0.028); c.lineTo(x0 + 18, h * 0.046); c.lineTo(x0 - 2, h * 0.046); c.fill(); }
    });
    var bodyM = new THREE.MeshStandardMaterial({ map: liv, roughness: 0.32, metalness: 0.18 });
    var fus = new THREE.Mesh(geo, bodyM); g.add(fus);
    var white = new THREE.MeshStandardMaterial({ color: 0xf1f2ef, roughness: 0.3, metalness: 0.2 }), neon = new THREE.MeshStandardMaterial({ color: 0xccff00, roughness: 0.35, emissive: 0x334400, emissiveIntensity: 0.35 }), grey = new THREE.MeshStandardMaterial({ color: 0xb9bdc0, roughness: 0.4, metalness: 0.4 }), dark = new THREE.MeshStandardMaterial({ color: 0x15181b, roughness: 0.5, metalness: 0.3 });
    function wingGeo(root, tip, span, sweep, thick) {
      var s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(-root, 0); s.lineTo(-sweep - tip, span); s.lineTo(-sweep, span); s.lineTo(0, 0);
      var gg = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: true, bevelThickness: thick * 0.45, bevelSize: thick * 0.45, bevelSegments: 2, curveSegments: 4 }); gg.translate(0, 0, -thick / 2); return gg;
    }
    [-1, 1].forEach(function (sd) {
      var w = new THREE.Mesh(wingGeo(8.4, 2.1, 17.5, 9.5, 0.36), white); w.rotation.x = sd > 0 ? Math.PI / 2 : -Math.PI / 2; w.rotation.y = sd * 0.0; w.position.set(5.2, -1.15, sd * 1.2);
      var wg = new THREE.Group(); wg.add(w); wg.rotation.x = sd * -0.09; g.add(wg);
      var wl = new THREE.Mesh(wingGeo(2.0, 0.7, 2.6, 1.6, 0.12), neon); wl.rotation.y = 0; wl.position.set(5.2 - 9.5 - 0.1, -1.15 + 0.05, sd * (1.2 + 17.4)); wl.rotation.x = sd > 0 ? -0.25 : 0.25; wl.position.y += 0.0; wl.rotation.z = 0; wl.scale.set(1, 1, 1); wg.add(wl);
      var nav = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), new THREE.MeshBasicMaterial({ color: sd > 0 ? 0x29ff6a : 0xff2a2a })); nav.position.set(5.2 - 10.5, -1.1, sd * 18.7); wg.add(nav);
      var nac = new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(1.18, -2.6), new THREE.Vector2(1.42, -1.6), new THREE.Vector2(1.5, 0), new THREE.Vector2(1.38, 1.6), new THREE.Vector2(1.28, 2.2)], 32).rotateZ(-Math.PI / 2), white);
      nac.position.set(4.6, -2.65, sd * 7.2); g.add(nac);
      var lip = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.1, 8, 32), grey); lip.rotation.y = Math.PI / 2; lip.position.set(6.8, -2.65, sd * 7.2); g.add(lip);
      var fan = new THREE.Mesh(new THREE.CircleGeometry(1.25, 32), dark); fan.rotation.y = Math.PI / 2; fan.position.set(6.6, -2.65, sd * 7.2); g.add(fan);
      var spin = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.8, 16).rotateZ(-Math.PI / 2), grey); spin.position.set(6.95, -2.65, sd * 7.2); g.add(spin);
      for (var b = 0; b < 14; b++) { var bl = new THREE.Mesh(new THREE.BoxGeometry(0.02, 1.1, 0.16), grey); bl.position.set(6.62, -2.65 + Math.cos(b / 14 * 6.28) * 0.7, sd * 7.2 + Math.sin(b / 14 * 6.28) * 0.7); bl.rotation.x = b / 14 * 6.28; g.add(bl); }
      var ex = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.6, 20).rotateZ(Math.PI / 2), grey); ex.position.set(1.9, -2.65, sd * 7.2); g.add(ex);
      var py = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.1, 0.35), white); py.position.set(3.9, -1.75, sd * 7.2); g.add(py);
      var hs = new THREE.Mesh(wingGeo(4.2, 1.5, 7.4, 4.2, 0.22), white); hs.rotation.x = sd > 0 ? Math.PI / 2 : -Math.PI / 2; hs.position.set(-15.6, 1.15, sd * 0.4); g.add(hs);
      for (var gw = 0; gw < 2; gw++) for (var gz = 0; gz < 2; gz++) { var wh = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.42, 20), dark); wh.rotation.x = Math.PI / 2; wh.position.set(-0.6 + gw * 1.5, -3.15, sd * (2.4 + gz * 0.55)); g.add(wh); }
      var st = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.7, 8), grey); st.position.set(0.15, -2.2, sd * 2.65); g.add(st);
    });
    var vs = new THREE.Shape(); vs.moveTo(0, 0); vs.lineTo(-7.2, 0); vs.lineTo(-10.2, 8.4); vs.lineTo(-7.6, 8.6); vs.lineTo(0, 0);
    var vg = new THREE.ExtrudeGeometry(vs, { depth: 0.34, bevelEnabled: true, bevelThickness: 0.14, bevelSize: 0.14, bevelSegments: 2 }); vg.translate(0, 0, -0.17);
    var vf = new THREE.Mesh(vg, neon); vf.position.set(-12.6, 1.7, 0); g.add(vf);
    var logoT = canvasTex(256, 256, function (c, w, h) { c.clearRect(0, 0, w, h); c.strokeStyle = "#0b0d0b"; c.lineWidth = 14; c.beginPath(); c.arc(128, 128, 84, 0, 7); c.stroke(); c.beginPath(); c.ellipse(128, 128, 34, 84, 0, 0, 7); c.stroke(); c.beginPath(); c.moveTo(44, 128); c.lineTo(212, 128); c.stroke(); });
    [-1, 1].forEach(function (sd) { var lg = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), new THREE.MeshBasicMaterial({ map: logoT, transparent: true })); lg.position.set(-19.2, 6.2, sd * 0.34); if (sd < 0) lg.rotation.y = Math.PI; g.add(lg); });
    var beacon = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3030 })); beacon.position.set(-2, 2.1, 0); g.add(beacon); g.userData.beacon = beacon;
    var ngw = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.5, 16), dark); ngw.rotation.x = Math.PI / 2; ngw.position.set(14, -3.35, 0); g.add(ngw);
    var ngs = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.7, 8), grey); ngs.position.set(14, -2.5, 0); g.add(ngs);
    var bellyF = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 9, 24, 1, false, Math.PI * 0.5, Math.PI), white); bellyF.rotation.z = Math.PI / 2; bellyF.scale.set(1, 1, 0.9); bellyF.position.set(1.5, -1.2, 0); g.add(bellyF);
    g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  }
  var jet = airliner();
  var JET_HOME = { x: AX2 + 22 + 18.5, z: 12, yaw: Math.PI };
  function placeJet(x, y, z, yaw, pitch) { jet.position.set(x, 3.75 + y, z); jet.rotation.set(0, yaw, pitch || 0); }
  placeJet(JET_HOME.x, 0, JET_HOME.z, JET_HOME.yaw);
  scene.add(jet);

  /* ================= Cars ================= */
  var CAR_TYPES = {
    sedan: { L: 4.7, W: 1.86, belt: 0.98, roof: 1.45, hx: 0.85, wsT: 0.15, rfE: -1.15, rx: -1.75, r: 0.35, cl: 0.28 },
    suv: { L: 4.85, W: 1.96, belt: 1.12, roof: 1.78, hx: 1.05, wsT: 0.45, rfE: -1.95, rx: -2.2, r: 0.41, cl: 0.36 },
    hatch: { L: 4.05, W: 1.8, belt: 0.98, roof: 1.5, hx: 0.75, wsT: 0.1, rfE: -1.65, rx: -1.85, r: 0.34, cl: 0.27 },
    van: { L: 5.3, W: 2.0, belt: 1.15, roof: 2.15, hx: 1.85, wsT: 1.35, rfE: -2.5, rx: -2.6, r: 0.4, cl: 0.32 },
    coupe: { L: 4.5, W: 1.9, belt: 0.86, roof: 1.24, hx: 0.55, wsT: -0.4, rfE: -1.25, rx: -1.9, r: 0.36, cl: 0.2 },
    pickup: { L: 5.6, W: 2.0, belt: 1.15, roof: 1.88, hx: 1.25, wsT: 0.75, rfE: -0.45, rx: -0.7, r: 0.45, cl: 0.44, bed: true },
    bus: { L: 11.4, W: 2.55, belt: 1.3, roof: 3.05, hx: 5.3, wsT: 5.2, rfE: -5.45, rx: -5.6, r: 0.5, cl: 0.42, bus: true },
    truck: { L: 7.2, W: 2.3, belt: 1.35, roof: 2.45, hx: 3.25, wsT: 2.95, rfE: 2.0, rx: 1.8, r: 0.5, cl: 0.46, box: 2.6 }
  };
  var boxSideTex = canvasTex(1024, 384, function (c, w, h) { c.fillStyle = "#f4f4f0"; c.fillRect(0, 0, w, h); c.fillStyle = "#1f6b35"; c.fillRect(0, h - 60, w, 60); c.fillStyle = "#1f6b35"; c.font = "800 120px Unbounded, 'Arial Black', sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("FRESH MART", w / 2, h / 2 - 30); c.font = "600 44px 'JetBrains Mono', monospace"; c.fillStyle = "#333"; c.fillText("GROCERY DELIVERY", w / 2, h / 2 + 60); });
  var boxSideM = new THREE.MeshStandardMaterial({ map: boxSideTex, roughness: 0.6 }), boxWhiteM = new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.6 });
  var busStripeM = new THREE.MeshStandardMaterial({ color: 0xccff00, emissive: 0xccff00, emissiveIntensity: 0.15, roughness: 0.5 });
  var busSignM = new THREE.MeshStandardMaterial({ map: signTex("CITY LOOP  \u00b7  AIRPORT", { w: 1024, h: 128, bg: "#0b0d0b", fg: "#ffb02e", size: 70 }), emissive: 0xffb02e, emissiveIntensity: 0.5 });
  var polRedM = new THREE.MeshStandardMaterial({ color: 0x500000, emissive: 0xff1a1a, emissiveIntensity: 1, roughness: 0.3 }), polBlueM = new THREE.MeshStandardMaterial({ color: 0x000a50, emissive: 0x2a5bff, emissiveIntensity: 1, roughness: 0.3 });
  var polTextM = new THREE.MeshStandardMaterial({ map: signTex("POLICE", { w: 512, h: 96, bg: "#f4f4f2", fg: "#13306b", size: 70 }), roughness: 0.5 });
  var carGlass = new THREE.MeshPhysicalMaterial({ color: 0x0b1118, metalness: 0.2, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.4 });
  var carBlack = new THREE.MeshStandardMaterial({ color: 0x0d0e10, roughness: 0.55 });
  var carChrome = new THREE.MeshStandardMaterial({ color: 0xd9dde2, roughness: 0.15, metalness: 1 });
  var tireM = new THREE.MeshStandardMaterial({ color: 0x121212, roughness: 0.92 });
  var rimM = new THREE.MeshStandardMaterial({ color: 0xb7bcc2, metalness: 0.9, roughness: 0.25 });
  var headM = new THREE.MeshStandardMaterial({ color: 0xf6f8ff, emissive: 0xfff1c8, emissiveIntensity: 0.3, roughness: 0.1, metalness: 0.4 });
  var tailM = new THREE.MeshStandardMaterial({ color: 0x5c0707, emissive: 0xff1a1a, emissiveIntensity: 0.4, roughness: 0.3 });
  var plateM = new THREE.MeshStandardMaterial({ map: canvasTex(256, 128, function (g, w, h) { g.fillStyle = "#f4f4ee"; g.fillRect(0, 0, w, h); g.strokeStyle = "#1a3a7a"; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8); g.fillStyle = "#1a3a7a"; g.font = "800 58px 'JetBrains Mono', monospace"; g.textAlign = "center"; g.fillText("PW-2026", w / 2, 86); g.font = "600 20px sans-serif"; g.fillText("NEW YORK", w / 2, 30); }), roughness: 0.5 });
  var taxiSignM = new THREE.MeshStandardMaterial({ map: signTex("TAXI", { w: 256, h: 96, bg: "#ffffff", fg: "#111111", size: 64 }), emissive: 0xfff3b0, emissiveIntensity: 0.3, roughness: 0.4 });
  var carLightMats = [headM, tailM, taxiSignM];
  function pillar(g, mat, x1, y1, x2, y2, z, th) {
    var l = Math.hypot(x2 - x1, y2 - y1), m = new THREE.Mesh(new THREE.BoxGeometry(l, th, th), mat);
    m.position.set((x1 + x2) / 2, (y1 + y2) / 2, z); m.rotation.z = Math.atan2(y2 - y1, x2 - x1); g.add(m);
  }
  /* merge each car's parts by material so 60+ draw calls become ~15 */
  function mergeInto(parent, meshes) {
    var by = new Map();
    meshes.forEach(function (o) { o.updateMatrix(); var geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); geo.applyMatrix4(o.matrix); if (!geo.attributes.uv) return; if (!by.has(o.material)) by.set(o.material, []); by.get(o.material).push(geo); parent.remove(o); });
    by.forEach(function (geos, mat) {
      var n = 0; geos.forEach(function (q) { n += q.attributes.position.count; });
      var pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), off = 0;
      geos.forEach(function (q) { pos.set(q.attributes.position.array, off * 3); nor.set(q.attributes.normal.array, off * 3); uv.set(q.attributes.uv.array, off * 2); off += q.attributes.position.count; q.dispose(); });
      var bg = new THREE.BufferGeometry(); bg.setAttribute("position", new THREE.BufferAttribute(pos, 3)); bg.setAttribute("normal", new THREE.BufferAttribute(nor, 3)); bg.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
      var m = new THREE.Mesh(bg, mat); m.castShadow = true; parent.add(m);
    });
  }
  function bakeCar(g) {
    mergeInto(g, g.children.filter(function (o) { return o.isMesh; }));
    g.userData.wheels.forEach(function (w) { mergeInto(w, w.children.filter(function (o) { return o.isMesh; })); });
  }
  function carMesh(color, kind, taxiOn) {
    var T = CAR_TYPES[kind] || CAR_TYPES.sedan, L = T.L, W = T.W, r = T.r, h2 = L / 2, g = new THREE.Group();
    var paint = new THREE.MeshPhysicalMaterial({ color: color, metalness: 0.55, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.06 });
    var wb = L * 0.3 + 0.1, wf = wb + 0.05, wr = -wb + 0.05, R = r + 0.08, y0 = T.cl;
    var s = new THREE.Shape();
    s.moveTo(-h2 + 0.05, y0);
    s.lineTo(wr - R, y0); s.absarc(wr, r, R, Math.PI, 0, true);
    s.lineTo(wf - R, y0); s.absarc(wf, r, R, Math.PI, 0, true);
    s.lineTo(h2 - 0.08, y0); s.quadraticCurveTo(h2 + 0.04, y0 + 0.05, h2, 0.62);
    s.quadraticCurveTo(h2 - 0.02, T.belt - 0.12, h2 - 0.35, T.belt - 0.06);
    s.lineTo(T.hx, T.belt); s.lineTo(T.rx, T.belt);
    s.quadraticCurveTo(-h2 + 0.1, T.belt - 0.02, -h2 + 0.02, T.belt - 0.2);
    s.lineTo(-h2, 0.55); s.quadraticCurveTo(-h2, y0, -h2 + 0.05, y0);
    var bg = new THREE.ExtrudeGeometry(s, { depth: W - 0.12, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 3, curveSegments: 10 });
    bg.translate(0, 0, -(W - 0.12) / 2);
    g.add(new THREE.Mesh(bg, paint));
    var gs = new THREE.Shape();
    gs.moveTo(T.hx, T.belt - 0.01); gs.lineTo(T.wsT, T.roof); gs.lineTo(T.rfE, T.roof); gs.lineTo(T.rx, T.belt - 0.01); gs.lineTo(T.hx, T.belt - 0.01);
    var gg = new THREE.ExtrudeGeometry(gs, { depth: W - 0.3, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 });
    gg.translate(0, 0, -(W - 0.3) / 2);
    g.add(new THREE.Mesh(gg, carGlass));
    var roof = new THREE.Mesh(new THREE.BoxGeometry(T.wsT - T.rfE + 0.06, 0.07, W - 0.26), paint); roof.position.set((T.wsT + T.rfE) / 2, T.roof + 0.03, 0); g.add(roof);
    [-1, 1].forEach(function (sd) {
      var z = sd * (W / 2 - 0.14);
      pillar(g, paint, T.hx, T.belt, T.wsT, T.roof + 0.02, z, 0.08);
      pillar(g, paint, T.rx, T.belt, T.rfE, T.roof + 0.02, z, 0.09);
      var bx = (T.wsT + T.rfE) / 2 + 0.15; pillar(g, carBlack, bx, T.belt, bx, T.roof, z * 1.01, 0.09);
      if (kind === "suv" || kind === "van") { var cx2 = T.rfE + 0.55; pillar(g, carBlack, cx2, T.belt, cx2, T.roof, z * 1.01, 0.09); }
      var mir = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.13, 0.17), paint); mir.position.set(T.hx - 0.12, T.belt + 0.13, sd * (W / 2 + 0.1)); g.add(mir);
      var mg = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.1, 0.14), carGlass); mg.position.set(T.hx - 0.23, T.belt + 0.13, sd * (W / 2 + 0.1)); g.add(mg);
      var arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 0.14), carBlack); arm.position.set(T.hx - 0.1, T.belt + 0.08, sd * (W / 2 + 0.0)); g.add(arm);
      var seam = new THREE.Mesh(new THREE.BoxGeometry(0.015, T.belt - y0 - 0.15, 0.01), carBlack); seam.position.set(bx, (T.belt + y0) / 2, sd * (W / 2 - 0.0)); g.add(seam);
      var seam2 = seam.clone(); seam2.position.x = T.hx - 0.05; g.add(seam2);
      var handle = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.035, 0.02), carChrome); handle.position.set(bx + 0.35, T.belt - 0.12, sd * (W / 2 + 0.01)); g.add(handle);
      var handle2 = handle.clone(); handle2.position.x = bx - 0.55; g.add(handle2);
      var trim = new THREE.Mesh(new THREE.BoxGeometry(T.hx - T.rx, 0.03, 0.02), carChrome); trim.position.set((T.hx + T.rx) / 2, T.belt + 0.005, sd * (W / 2 - 0.08)); g.add(trim);
      var sill = new THREE.Mesh(new THREE.BoxGeometry(wf - wr - 2 * R - 0.05, 0.12, 0.04), carBlack); sill.position.set((wf + wr) / 2, y0 + 0.06, sd * (W / 2 - 0.02)); g.add(sill);
    });
    var grille = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, W * 0.5), carBlack); grille.position.set(h2 + 0.02, 0.55, 0); g.add(grille);
    var bumperF = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, W - 0.1), carBlack); bumperF.position.set(h2 + 0.02, y0 + 0.1, 0); g.add(bumperF);
    var bumperR = bumperF.clone(); bumperR.position.x = -h2 - 0.02; g.add(bumperR);
    [-1, 1].forEach(function (sd) {
      var hl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.42), headM); hl.position.set(h2 - 0.02, 0.74, sd * (W / 2 - 0.32)); g.add(hl);
      var tl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.46), tailM); tl.position.set(-h2 + 0.01, T.belt - 0.22, sd * (W / 2 - 0.3)); g.add(tl);
    });
    var pf = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.15, 0.5), plateM); pf.position.set(h2 + 0.09, y0 + 0.2, 0); pf.rotation.y = Math.PI / 2; pf.geometry = new THREE.PlaneGeometry(0.5, 0.15); g.add(pf);
    var pr = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.15), plateM); pr.position.set(-h2 - 0.09, y0 + 0.32, 0); pr.rotation.y = -Math.PI / 2; g.add(pr);
    var under = new THREE.Mesh(new THREE.BoxGeometry(L - 0.4, 0.12, W - 0.3), carBlack); under.position.set(0, y0 + 0.02, 0); g.add(under);
    g.userData.wheels = [];
    [[wf, 1], [wf, -1], [wr, 1], [wr, -1]].forEach(function (p) {
      var w = new THREE.Group();
      var tr = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.24, 24), tireM); tr.rotation.x = Math.PI / 2; w.add(tr);
      var rm = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.62, r * 0.62, 0.25, 20), rimM); rm.rotation.x = Math.PI / 2; w.add(rm);
      for (var k = 0; k < 5; k++) { var sp = new THREE.Mesh(new THREE.BoxGeometry(r * 1.1, 0.05, 0.02), carChrome); sp.rotation.z = k * Math.PI / 5; sp.position.z = p[1] * 0.13; w.add(sp); }
      var hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.27, 10), carBlack); hub.rotation.x = Math.PI / 2; w.add(hub);
      w.position.set(p[0], r, p[1] * (W / 2 - 0.16)); w.userData.front = p[0] === wf; g.add(w); g.userData.wheels.push(w);
    });
    if (taxiOn === true) {
      var sg = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.22, 0.28), taxiSignM); sg.position.set((T.wsT + T.rfE) / 2, T.roof + 0.18, 0); g.add(sg);
      var chk = canvasTex(256, 32, function (c, w, h) { for (var i = 0; i < 16; i++) for (var j = 0; j < 2; j++) { c.fillStyle = (i + j) % 2 ? "#111" : "#f2c230"; c.fillRect(i * 16, j * 16, 16, 16); } });
      [-1, 1].forEach(function (sd) { var st = new THREE.Mesh(new THREE.PlaneGeometry(T.hx - T.rx, 0.1), new THREE.MeshStandardMaterial({ map: chk, roughness: 0.5 })); st.position.set((T.hx + T.rx) / 2, T.belt - 0.3, sd * (W / 2 + 0.005)); if (sd < 0) st.rotation.y = Math.PI; g.add(st); });
    }
    if (T.bed) { var bed = new THREE.Mesh(new THREE.BoxGeometry(T.rx + h2 - 0.4, 0.5, W - 0.34), carBlack); bed.position.set((T.rx - h2) / 2 + 0.05, T.belt - 0.2, 0); g.add(bed); }
    if (T.box) {
      var bl = T.rx + h2 - 0.1, cb = new THREE.Mesh(new THREE.BoxGeometry(bl, T.box, W + 0.08), boxWhiteM); cb.position.set((T.rx - h2) / 2 - 0.02, T.belt + T.box / 2 - 0.25, 0); g.add(cb);
      [-1, 1].forEach(function (sd) { var sp = new THREE.Mesh(new THREE.PlaneGeometry(bl - 0.2, T.box - 0.2), boxSideM); sp.position.set(cb.position.x, cb.position.y, sd * (W / 2 + 0.05)); if (sd < 0) sp.rotation.y = Math.PI; g.add(sp); });
    }
    if (T.bus) {
      for (var bp = T.rfE + 1.4; bp < T.wsT - 0.6; bp += 1.45) [-1, 1].forEach(function (sd) { pillar(g, carBlack, bp, T.belt, bp, T.roof, sd * (W / 2 - 0.13), 0.1); });
      [-1, 1].forEach(function (sd) { var bs = new THREE.Mesh(new THREE.BoxGeometry(L - 0.6, 0.16, 0.02), busStripeM); bs.position.set(0, T.belt - 0.25, sd * (W / 2 + 0.01)); g.add(bs); });
      var ds = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.5, 0.3), busSignM); ds.position.set(h2 - 0.12, T.roof - 0.22, 0); ds.rotation.y = Math.PI / 2; g.add(ds);
    }
    if (taxiOn === "police") {
      var lb = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, W * 0.38), polRedM); lb.position.set((T.wsT + T.rfE) / 2, T.roof + 0.12, W * 0.2); g.add(lb);
      var lb2 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, W * 0.38), polBlueM); lb2.position.set((T.wsT + T.rfE) / 2, T.roof + 0.12, -W * 0.2); g.add(lb2);
      [-1, 1].forEach(function (sd) { var pt = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.24), polTextM); pt.position.set((T.hx + T.rx) / 2 - 0.2, T.belt - 0.3, sd * (W / 2 + 0.006)); if (sd < 0) pt.rotation.y = Math.PI; g.add(pt); });
      var hood = new THREE.Mesh(new THREE.BoxGeometry(h2 - T.hx - 0.1, 0.02, W - 0.2), carBlack); hood.position.set((h2 + T.hx) / 2 - 0.1, T.belt + 0.01, 0); g.add(hood);
    }
    bakeCar(g);
    g.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
    g.userData.L = L; g.userData.W = W; g.userData.r = r;
    return g;
  }
  var CAR_COLORS = [0x15181c, 0xf4f4f2, 0x8a1c1c, 0x1d3f7a, 0x9aa1a8, 0x2f5d3a, 0xcaa36a, 0x3b3f45, 0x5a6b7a, 0x6b1f3a, 0xe8e4d8, 0x24324a];
  var KINDS = ["sedan", "suv", "hatch", "coupe", "pickup", "van", "sedan", "suv"];
  var TRAFFIC = [], CARS = [], POLICE = [];
  var LANE_PLAN = ["sedan", "taxi", "suv", "bus", "coupe", "hatch", "pickup", "police", "sedan", "truck", "suv", "taxi", "van", "coupe", "hatch", "sedan"];
  [-1, 1].forEach(function (dir, li) {
    var span = CITY_X2 + 1 - (CITY_X1 - 20), n = LANE_PLAN.length, step = span / n;
    LANE_PLAN.forEach(function (k, i) {
      var kk = LANE_PLAN[(i + li * 5) % n], isTaxi = kk === "taxi", isPol = kk === "police", kind = isTaxi || isPol ? "sedan" : kk;
      var col = isTaxi ? 0xf2c230 : isPol ? 0xf4f4f2 : kind === "bus" ? 0x1d3f7a : CAR_COLORS[(i * 5 + li * 3) % CAR_COLORS.length];
      var mesh = carMesh(col, kind, isTaxi ? true : isPol ? "police" : false); scene.add(mesh);
      var vm = kind === "bus" || kind === "truck" ? 7.5 : 8.5 + ((i * 7) % 5) * 0.9;
      var tc = { m: mesh, dir: dir, x: CITY_X1 - 20 + step * (i + 0.5), z: dir > 0 ? 3.6 : -3.6, v: vm, vmax: vm };
      TRAFFIC.push(tc); CARS.push(tc); if (isPol) POLICE.push(mesh);
    });
  });
  (function () {
    var r = rng(55);
    [-1, 1].forEach(function (sd) {
      for (var x = CITY_X1 + 8; x < CITY_X2 - 6; x += 9 + Math.floor(r() * 8)) {
        if (Math.abs(x + 25) < 6 || Math.abs(x - 20) < 6 || (sd > 0 && x > -78 && x < -48) || (sd > 0 && x > -14 && x < 14) || (sd < 0 && x > 40 && x < 56)) continue;
        if (r() < 0.35) continue;
        var kind = KINDS[Math.floor(r() * KINDS.length)], m = carMesh(CAR_COLORS[Math.floor(r() * CAR_COLORS.length)], kind, false);
        var z = sd * 5.9; m.position.set(x, 0, z); m.rotation.y = sd > 0 ? 0 : Math.PI; scene.add(m);
        var L = m.userData.L, W = m.userData.W;
        solid(x - L / 2, x + L / 2, z - W / 2, z + W / 2, "car");
      }
    });
    [44, 52].forEach(function (x) { var m = carMesh(0xf4f4f2, "sedan", "police"); m.position.set(x, 0, -5.9); m.rotation.y = Math.PI; scene.add(m); POLICE.push(m); solid(x - m.userData.L / 2, x + m.userData.L / 2, -5.9 - m.userData.W / 2, -5.9 + m.userData.W / 2, "car"); });
    [[-63, 115], [-49, 115]].forEach(function (p) { var m = carMesh(0xf4f4f0, "truck", false); m.position.set(p[0], 0.02, p[1]); m.rotation.y = Math.PI / 2; scene.add(m); solid(p[0] - m.userData.W / 2, p[0] + m.userData.W / 2, p[1] - m.userData.L / 2, p[1] + m.userData.L / 2, "car"); });
    (function () { var m = carMesh(0x8a1c1c, "pickup", false); m.position.set(-38, 0.02, 80); m.rotation.y = 0.3; scene.add(m); solid(-40.8, -35.2, 79, 81, "car"); })();
    [[-76, 21], [-70.8, 21], [-55, 21], [-49.8, 21], [-60, 21]].forEach(function (p, i) {
      var m = carMesh(CAR_COLORS[(i * 3) % CAR_COLORS.length], KINDS[(i + 1) % KINDS.length], false);
      m.position.set(p[0], 0.02, p[1] + 1); m.rotation.y = Math.PI / 2; scene.add(m);
      solid(p[0] - m.userData.W / 2, p[0] + m.userData.W / 2, p[1] + 1 - m.userData.L / 2, p[1] + 1 + m.userData.L / 2, "car");
    });
  })();
  var taxi = { m: carMesh(0xf2c230, "sedan", true), x: -65.5, z: 18, yaw: Math.PI / 2, v: 0, steer: 0 };
  scene.add(taxi.m);
  CARS.push(taxi);
  function carPush(p, rad) {
    for (var i = 0; i < CARS.length; i++) {
      var c = CARS[i]; if (c.skip) continue; var yaw = c.yaw !== undefined ? c.yaw : (c.dir > 0 ? 0 : Math.PI), L = c.m.userData.L / 2 + rad, W = c.m.userData.W / 2 + rad;
      var dx = p.x - c.x, dz = p.z - c.z, cs = Math.cos(yaw), sn = Math.sin(yaw);
      var lx = dx * cs - dz * sn, lz = dx * sn + dz * cs;
      if (Math.abs(lx) < L && Math.abs(lz) < W) {
        var px = L - Math.abs(lx), pz = W - Math.abs(lz);
        if (px < pz) lx = Math.sign(lx || 1) * L; else lz = Math.sign(lz || 1) * W;
        p.x = c.x + lx * cs + lz * sn; p.z = c.z - lx * sn + lz * cs;
      }
    }
  }
  var taxiZone = { id: "taxi", x: -65.5, z: 18, r: 3.4 }; ZONES.push(taxiZone);
  ZONES.push({ id: "cityhall", x: -100, z: -9.8, r: 2.6 });
  ZONES.push({ id: "tunnel", x: 63, z: 9, r: 2.6 });
  ZONES.push({ id: "toCity", x: AX1 - 8, z: 9, r: 2.6 });
  /* ================= Landmark at the west end of the avenue ================= */
  var ANIMS = [], MAPR = [];
  function mapRect(x1, x2, z1, z2, col, line) { MAPR.push({ x1: Math.min(x1, x2), x2: Math.max(x1, x2), z1: Math.min(z1, z2), z2: Math.max(z1, z2), c: col, l: line || "" }); }
  function mesh(geo, mat, x, y, z, noShadow) { var m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (!noShadow) { m.castShadow = true; m.receiveShadow = true; } scene.add(m); return m; }
  var LMX = -216, LMZ = 0;
  (false) && (function () {
    plane(56, 60, M.walk, LMX + 4, 0.03, 0);
    mapRect(LMX - 24, LMX + 32, -30, 30, "#3b403a");
    var r = rng(CS.seed), x = LMX, z = LMZ;
    var stone = new THREE.MeshStandardMaterial({ color: 0xd9d0bf, roughness: 0.8 }), sand = new THREE.MeshStandardMaterial({ color: 0xd3b47a, roughness: 0.95, flatShading: true });
    var gold = new THREE.MeshStandardMaterial({ color: 0xd8a93b, metalness: 0.9, roughness: 0.3 }), red = new THREE.MeshStandardMaterial({ color: 0xc2352b, roughness: 0.55 });
    var glassT = facade("glass", CS.seed % 97), stoneT = facade("stone", CS.seed % 89), whiteM = new THREE.MeshStandardMaterial({ color: 0xf4f2ec, roughness: 0.35 });
    var bronze = new THREE.MeshStandardMaterial({ color: 0x5b4a3a, roughness: 0.6, metalness: 0.5, wireframe: true });
    var foot = 10;
    function cone4(rad, h, mat, y) { var c = mesh(new THREE.ConeGeometry(rad, h, 4), mat, x, y + h / 2, z); c.rotation.y = Math.PI / 4; return c; }
    function tower(w, h, mat, y, d) { return mesh(new THREE.BoxGeometry(w, h, d || w), mat, x, y + h / 2, z); }
    switch (CS.lm) {
      case "spire": tower(18, 46, stoneT, 0); tower(13, 22, stoneT, 46); tower(8.5, 16, stoneT, 68); tower(5, 10, stoneT, 84); mesh(new THREE.ConeGeometry(0.7, 22, 8), M.metal, x, 105, z); foot = 9; break;
      case "clock":
        tower(9, 52, stoneT, 0); tower(10.5, 10, stone, 52);
        var face = canvasTex(256, 256, function (g, w) { g.fillStyle = "#e9e1c8"; g.beginPath(); g.arc(128, 128, 120, 0, 7); g.fill(); g.strokeStyle = "#1a1a1a"; g.lineWidth = 8; g.stroke(); for (var i = 0; i < 12; i++) { var a = i / 12 * Math.PI * 2; g.fillStyle = "#1a1a1a"; g.fillRect(128 + Math.sin(a) * 96 - 4, 128 - Math.cos(a) * 96 - 10, 8, 20); } g.lineWidth = 10; g.beginPath(); g.moveTo(128, 128); g.lineTo(128, 52); g.moveTo(128, 128); g.lineTo(178, 150); g.stroke(); });
        var fm = new THREE.MeshStandardMaterial({ map: face, emissive: 0xfff2c8, emissiveMap: face, emissiveIntensity: 0.2 }); nightMats.push(fm);
        [0, 1, 2, 3].forEach(function (i) { var p = mesh(new THREE.PlaneGeometry(8, 8), fm, x + Math.sin(i * Math.PI / 2) * 5.3, 57, z + Math.cos(i * Math.PI / 2) * 5.3, true); p.rotation.y = i * Math.PI / 2; });
        cone4(8, 16, M.dark, 62); mesh(new THREE.ConeGeometry(0.4, 8, 6), gold, x, 82, z); foot = 6; break;
      case "lattice":
        var lm = CS.lmName === "Red Tower" ? new THREE.MeshStandardMaterial({ color: 0xd4402a, roughness: 0.6, wireframe: true }) : bronze;
        var lat = mesh(new THREE.CylinderGeometry(0.6, 15, 86, 4, 18, true), lm, x, 43, z); lat.rotation.y = Math.PI / 4;
        [[18, 13], [42, 7], [64, 3.6]].forEach(function (p) { var b = mesh(new THREE.BoxGeometry(p[1] * 1.45, 1.2, p[1] * 1.45), new THREE.MeshStandardMaterial({ color: lm.color.getHex(), roughness: 0.6 }), x, p[0], z); b.rotation.y = 0; });
        mesh(new THREE.CylinderGeometry(0.15, 0.3, 14, 6), M.metal, x, 93, z); foot = 12; break;
      case "needle":
        mesh(new THREE.CylinderGeometry(1.6, 3.2, 64, 16), whiteM, x, 32, z); mesh(new THREE.CylinderGeometry(9, 6, 5, 24), glassT, x, 62, z); mesh(new THREE.CylinderGeometry(10, 9, 1, 24), whiteM, x, 65, z);
        mesh(new THREE.CylinderGeometry(0.2, 0.6, 24, 8), M.metal, x, 77, z); [0, 1, 2].forEach(function (i) { var l = mesh(new THREE.CylinderGeometry(0.5, 1, 30, 8), whiteM, x + Math.sin(i * 2.1) * 5, 14, z + Math.cos(i * 2.1) * 5); l.rotation.set(Math.cos(i * 2.1) * 0.18, 0, -Math.sin(i * 2.1) * 0.18); }); foot = 7; break;
      case "dome":
        mesh(new THREE.CylinderGeometry(13, 14, 12, 32), stone, x, 6, z); mesh(new THREE.CylinderGeometry(10.5, 10.5, 6, 32), stoneT, x, 15, z);
        mesh(new THREE.SphereGeometry(10.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), CS.lmName === "Hilltop Observatory" ? new THREE.MeshStandardMaterial({ color: 0x8c9aa3, metalness: 0.8, roughness: 0.3 }) : new THREE.MeshStandardMaterial({ color: 0x6f8f9a, roughness: 0.5 }), x, 18, z);
        mesh(new THREE.CylinderGeometry(1.4, 1.4, 4, 12), stone, x, 30, z); mesh(new THREE.ConeGeometry(1.6, 3, 12), gold, x, 33.5, z);
        if (CS.lmName === "Grand Dome") [[-16, -16], [16, -16], [-16, 16], [16, 16]].forEach(function (p) { mesh(new THREE.CylinderGeometry(0.9, 1.1, 42, 12), stone, x + p[0], 21, z + p[1]); mesh(new THREE.ConeGeometry(1.1, 6, 12), M.metal, x + p[0], 45, z + p[1]); });
        foot = 14; break;
      case "gate":
        [-11, 11].forEach(function (oz) { mesh(new THREE.BoxGeometry(4, 64, 4), red, x, 32, z + oz); [18, 40, 60].forEach(function (y) { mesh(new THREE.BoxGeometry(3, 3, 22), red, x, y, z); }); });
        for (var ci = 0; ci < 9; ci++) { var cl = mesh(new THREE.BoxGeometry(0.2, 0.2, 30), M.dark, x + 3 - ci * 0.01, 64 - ci * 6, z); cl.visible = ci === 0; }
        [-1, 1].forEach(function (s) { var cab = mesh(new THREE.BoxGeometry(0.3, 0.3, 70), red, x, 34, z + s * 30); cab.rotation.x = s * 0.88; }); foot = 13; break;
      case "lighthouse":
        var stripe = canvasTex(64, 256, function (g, w, h) { for (var i = 0; i < 8; i++) { g.fillStyle = i % 2 ? "#c62e2e" : "#f4f1ea"; g.fillRect(0, i * h / 8, w, h / 8); } });
        mesh(new THREE.CylinderGeometry(2.4, 4, 34, 24), new THREE.MeshStandardMaterial({ map: stripe, roughness: 0.6 }), x, 17, z); mesh(new THREE.CylinderGeometry(3.2, 3.2, 1, 24), M.dark, x, 34.5, z);
        var lamp = mesh(new THREE.CylinderGeometry(2, 2, 3.5, 16), new THREE.MeshStandardMaterial({ color: 0xfff6d0, emissive: 0xfff0b0, emissiveIntensity: 0.6, transparent: true, opacity: 0.85 }), x, 36.8, z);
        nightMats.push(lamp.material); mesh(new THREE.ConeGeometry(2.6, 3, 16), M.dark, x, 40, z); foot = 5; break;
      case "column":
        tower(14, 4, stone, 0); tower(8, 6, stoneT, 4); mesh(new THREE.CylinderGeometry(1.6, 1.9, 34, 20), stone, x, 27, z);
        mesh(new THREE.CylinderGeometry(2.4, 2.4, 1.2, 20), stone, x, 44.6, z); mesh(new THREE.ConeGeometry(1.2, 4, 10), gold, x, 47.2, z); mesh(new THREE.SphereGeometry(0.8, 12, 10), gold, x, 50, z);
        [-1, 1].forEach(function (s) { var wg = mesh(new THREE.BoxGeometry(0.2, 2.2, 3.4), gold, x, 48.6, z + s * 1.4); wg.rotation.x = s * 0.5; }); foot = 7; break;
      case "arch":
        var sh = new THREE.Shape(); sh.moveTo(-13, 0); sh.lineTo(13, 0); sh.lineTo(13, 34); sh.lineTo(-13, 34); sh.lineTo(-13, 0);
        var hole = new THREE.Path(); hole.moveTo(-5.5, 0); hole.lineTo(-5.5, 18); hole.absarc(0, 18, 5.5, Math.PI, 0, true); hole.lineTo(5.5, 0); hole.lineTo(-5.5, 0); sh.holes.push(hole);
        var ag = new THREE.ExtrudeGeometry(sh, { depth: 7, bevelEnabled: false }); ag.translate(0, 0, -3.5);
        var ar = mesh(ag, CS.lmName === "Martyrs Arch" ? whiteM : stone, x, 0, z); ar.rotation.y = Math.PI / 2;
        tower(8, 3, stone, 34, 28); foot = 4; break;
      case "arena":
        var arc = canvasTex(512, 128, function (g, w, h) { g.fillStyle = "#c9b48e"; g.fillRect(0, 0, w, h); g.fillStyle = "#3a2f24"; for (var i = 0; i < 16; i++) { g.beginPath(); g.moveTo(i * 32 + 6, h - 8); g.lineTo(i * 32 + 6, 56); g.arc(i * 32 + 16, 56, 10, Math.PI, 0); g.lineTo(i * 32 + 26, h - 8); g.fill(); } g.fillRect(0, 0, w, 6); }, true);
        arc.repeat.set(4, 3);
        mesh(new THREE.CylinderGeometry(24, 25, 22, 48, 1, true), new THREE.MeshStandardMaterial({ map: arc, roughness: 0.9, side: THREE.DoubleSide }), x, 11, z);
        mesh(new THREE.CylinderGeometry(17, 17, 12, 48, 1, true), new THREE.MeshStandardMaterial({ color: 0xa48e6a, side: THREE.DoubleSide, roughness: 0.9 }), x, 6, z); foot = 25; break;
      case "pyramid": cone4(46, 56, sand, 0); foot = 30; break;
      case "supertall":
        [[22, 50], [16, 42], [11, 36], [7, 26], [4, 16]].reduce(function (y, p) { mesh(new THREE.CylinderGeometry(p[0] * 0.48, p[0] * 0.55, p[1], 6), glassT, x, y + p[1] / 2, z); return y + p[1]; }, 0);
        mesh(new THREE.CylinderGeometry(0.3, 1.2, 46, 8), M.metal, x, 193, z); foot = 12; break;
      case "pagoda":
        var roofM = CS.lmName === "Golden Pagoda" ? gold : new THREE.MeshStandardMaterial({ color: 0x1f5a4a, roughness: 0.5 });
        for (var pi = 0, py = 0; pi < 5; pi++) { var pw = 16 - pi * 2.6, ph = 6.5 - pi * 0.6; tower(pw, ph, pi % 2 ? red : new THREE.MeshStandardMaterial({ color: 0xb8352a, roughness: 0.6 }), py); var rf = mesh(new THREE.ConeGeometry(pw * 0.95, 3.4, 4), roofM, x, py + ph + 1.4, z); rf.rotation.y = Math.PI / 4; py += ph + 2.4; }
        mesh(new THREE.CylinderGeometry(0.3, 0.6, 9, 8), gold, x, py + 4, z); foot = 9; break;
      case "trio":
        [-14, 0, 14].forEach(function (oz) { mesh(new THREE.BoxGeometry(10, 62, 9), glassT, x, 31, z + oz); });
        var deck = mesh(new THREE.BoxGeometry(14, 3, 44), new THREE.MeshStandardMaterial({ color: 0x6f7c84, metalness: 0.7, roughness: 0.3 }), x - 1, 63.5, z); foot = 8; break;
      case "twin":
        [-10, 10].forEach(function (oz) { mesh(new THREE.CylinderGeometry(6, 7.5, 90, 8), glassT, x, 45, z + oz); mesh(new THREE.CylinderGeometry(0.4, 2, 18, 8), M.metal, x, 99, z + oz); });
        mesh(new THREE.BoxGeometry(3, 3, 14), M.metal, x, 42, z); foot = 9; break;
      case "sails":
        tower(40, 6, stone, 0, 30);
        [[-10, 22, 1], [2, 18, 0.85], [12, 14, 0.7]].forEach(function (p) { var s = mesh(new THREE.SphereGeometry(p[1], 24, 12, 0, Math.PI, 0, Math.PI / 2), whiteM, x + p[0], 6, z); s.scale.set(0.9, 1.3 * p[2] + 0.2, 0.55); s.rotation.y = Math.PI / 2; });
        foot = 18; break;
    }
    solid(x - foot, x + foot, z - foot, z + foot, "bld");
    MAPB.push({ x1: x - foot, x2: x + foot, z1: z - foot, z2: z + foot, k: "landmark" });
    box(6, 1.4, 0.3, M.dark, x + foot + 4, 0.7, z + 0, {});
    sign(CS.lmName.toUpperCase(), 5.6, 0.9, x + foot + 4.16, 0.85, z, Math.PI / 2, { bg: "#111411", fg: "#ccff00", size: 70, w: 1024, h: 150 });
    solid(x + foot + 3.85, x + foot + 4.15, z - 3, z + 3);
  })();

  /* ================= Fronts on Main Street: signs, canopies, doors ================= */
  function front(x, side, title, sub, col) {
    return;
    var z = side < 0 ? -11.2 : 11.2, dz = side < 0 ? 0.06 : -0.06, ry = side < 0 ? 0 : Math.PI;
    box(5, 3.2, 0.12, new THREE.MeshStandardMaterial({ color: 0x111518, roughness: 0.15, metalness: 0.6 }), x, 1.75, z + dz * 2, { shadow: false });
    box(7, 0.25, 2.2, M.dark, x, 3.7, z - side * 1.05);
    sign(title, 9, 1.3, x, 4.75, z + dz * 3, ry, { bg: col || "#111411", fg: "#ffffff", size: 82, w: 1024, h: 148, sub: sub, subfg: "#ccff00" });
  }

  /* ================= Workplaces ================= */
  var WORK = [
    { id: "office", t: "Summit Tower", x: -29, z: -9.6, jobs: ["Company Owner", "Real Estate Agent", "Lawyer"], gig: "Office Assistant" },
    { id: "bank", t: "City Bank", x: 19, z: -9.8, jobs: ["Bank Owner", "Banker"], gig: "Bank Teller" },
    { id: "hotel", t: "Grand Hotel", x: -134, z: -9.8, jobs: ["Hotel Owner", "Hotel Receptionist", "Security Guard"], gig: "Bellhop" },
    { id: "diner", t: "Sunny Diner", x: -2, z: -9.8, jobs: ["Restaurant Owner", "Chef"], gig: "Waiter" },
    { id: "mart", t: "Fresh Mart stockroom", x: -76, z: -25, jobs: ["Grocery Store Owner", "Shop Assistant"], gig: "Shelf Stacker" },
    { id: "hospital", t: "City Hospital", x: -135, z: 9.8, jobs: ["Doctor", "Nurse"], gig: "Hospital Porter" },
    { id: "school", t: "Central School", x: -100, z: 9.8, jobs: ["Teacher"], gig: "Tutor" },
    { id: "cafe", t: "Corner Cafe", x: -33, z: 9.8, jobs: ["Barista"], gig: "Cafe Helper" },
    { id: "tech", t: "Tech Hub", x: 25, z: 9.8, jobs: ["Tech Founder", "Software Engineer"], gig: "IT Helper" },
    { id: "site", t: "Construction Site", x: 52, z: 9.9, jobs: ["Construction Worker"], gig: "Site Helper" },
    { id: "farm", t: "Green Acres Farm", x: -16.4, z: 69, jobs: ["Farm Owner", "Farmer"], gig: "Farm Hand" },
    { id: "oil", t: "Oil Field", x: 6.4, z: 70, jobs: ["Oil Field Owner", "Oil Rig Worker"], gig: "Rig Helper" },
    { id: "mine", t: "Gold Mine", x: -112, z: 108.6, jobs: ["Gold Mine Owner", "Miner"], gig: "Mine Helper" },
    { id: "factory", t: "Factory", x: 30, z: 110.4, jobs: ["Factory Owner", "Factory Worker"], gig: "Line Worker" },
    { id: "depot", t: "Truck Depot and Garage", x: -55, z: 104.4, jobs: ["Truck Driver", "Delivery Driver", "Mechanic"], gig: "Loader" },
    { id: "crew", t: "Airport Crew Room", x: 100, z: 27.6, jobs: ["Airline Pilot"], gig: "Baggage Handler" }
  ];
  var GOV = [["Police Officer", "Police HQ"], ["Detective", "Police HQ"], ["City Hall Clerk", "City Hall"], ["Land Registrar", "City Hall"], ["Immigration Officer", "Airport"], ["Customs Officer", "Airport"], ["Air Traffic Controller", "Airport"]];
  function workFor(job) { for (var i = 0; i < WORK.length; i++) if (WORK[i].jobs.indexOf(job) >= 0) return WORK[i]; return null; }
  WORK.forEach(function (w) { ZONES.push({ id: "job:" + w.id, x: w.x, z: w.z, r: 1.9, w: w }); });
  front(-134, -1, "GRAND HOTEL", "ROOMS  \u00b7  JOBS INSIDE", "#2a1f14");
  front(-2, -1, "SUNNY DINER", "BURGERS  \u00b7  COFFEE  \u00b7  24H", "#5a1414");
  front(19, -1, "CITY BANK", "SAVINGS  \u00b7  LOANS", "#0f2a4a");
  front(48, -1, "POLICE HQ", "GOVERNMENT  \u00b7  CITY POLICE", "#0d1b3a");
  front(-135, 1, "CITY HOSPITAL", "EMERGENCY  \u00b7  24 HOURS", "#7a1a1a");
  front(-100, 1, "CENTRAL SCHOOL", "EDUCATION  \u00b7  SINCE 1901", "#2a3a1a");
  front(-33, 1, "CORNER CAFE", "ESPRESSO  \u00b7  PASTRY", "#3a2a1a");
  front(25, 1, "TECH HUB", "STARTUPS  \u00b7  SOFTWARE", "#111411");
  ZONES.push({ id: "diner", x: -7.5, z: -9.8, r: 1.7 });
  ZONES.push({ id: "police", x: 48, z: -9.8, r: 1.9 });
  ZONES.push({ id: "busOut", x: 9, z: 9.4, r: 2 });
  /* bus stop shelter on Main Street */
  (function () {
    box(4.2, 0.12, 1.6, M.dark, 9, 2.6, 10.3); box(0.1, 2.5, 1.6, M.glass, 7, 1.3, 10.3, { shadow: false }); box(0.1, 2.5, 1.6, M.glass, 11, 1.3, 10.3, { shadow: false }); box(4, 0.1, 0.4, M.wood, 9, 0.65, 10.8);
    sign("BUS  \u00b7  OUTSKIRTS", 3.6, 0.5, 9, 2.95, 9.48, Math.PI, { bg: "#ccff00", fg: "#0b0d0b", size: 80, w: 1024, h: 140 });
  })();

  /* ================= Construction site (replaces a block) ================= */
  (function () {
    var x1 = 42, x2 = 62, z1 = 12, z2 = 28;
    plane(x2 - x1, z2 - z1, new THREE.MeshStandardMaterial({ color: 0x8a7457, roughness: 1 }), (x1 + x2) / 2, 0.02, (z1 + z2) / 2);
    mapRect(x1, x2, z1, z2, "#5a4a36", "rgba(242,194,48,0.8)");
    var fenceM = new THREE.MeshStandardMaterial({ color: 0xf2c230, roughness: 0.6 });
    box(x2 - x1, 2, 0.1, fenceM, (x1 + x2) / 2, 1, z1 + 0.05); solid(x1, (x1 + x2) / 2 - 2, z1 - 0.1, z1 + 0.2); solid((x1 + x2) / 2 + 2, x2, z1 - 0.1, z1 + 0.2);
    box(0.1, 2, z2 - z1, fenceM, x1, 1, (z1 + z2) / 2); box(0.1, 2, z2 - z1, fenceM, x2, 1, (z1 + z2) / 2); solid(x1 - 0.1, x1 + 0.1, z1, z2); solid(x2 - 0.1, x2 + 0.1, z1, z2); solid(x1, x2, z2 - 0.1, z2 + 0.1);
    sign("CONSTRUCTION SITE  \u00b7  HARD HATS", 7, 0.9, (x1 + x2) / 2, 2.6, z1 - 0.05, Math.PI, { bg: "#f2c230", fg: "#111", size: 70, w: 1024, h: 130 });
    var steel = new THREE.MeshStandardMaterial({ color: 0x7c8590, roughness: 0.5, metalness: 0.6 });
    for (var i = 0; i < 4; i++) for (var j = 0; j < 3; j++) { box(0.4, 12, 0.4, steel, 46 + i * 4, 6, 18 + j * 4); solid(45.8 + i * 4, 46.2 + i * 4, 17.8 + j * 4, 18.2 + j * 4); }
    [4, 8, 12].forEach(function (y) { box(13, 0.35, 0.35, steel, 52, y, 18); box(13, 0.35, 0.35, steel, 52, y, 26); for (var i = 0; i < 4; i++) box(0.35, 0.35, 8.4, steel, 46 + i * 4, y, 22); });
    box(13, 0.3, 9, new THREE.MeshStandardMaterial({ color: 0x9a9a94, roughness: 0.9 }), 52, 4, 22);
    var crane = new THREE.MeshStandardMaterial({ color: 0xf2c230, roughness: 0.5, wireframe: true });
    mesh(new THREE.BoxGeometry(1.6, 34, 1.6, 1, 14, 1), crane, 59, 17, 15.5); mesh(new THREE.BoxGeometry(26, 1.4, 1.4, 16, 1, 1), crane, 52, 34, 15.5);
    box(2.4, 1.6, 1.6, fenceM, 59, 35.6, 15.5); box(0.06, 12, 0.06, M.dark, 44, 28, 15.5); box(1.6, 0.8, 1.6, new THREE.MeshStandardMaterial({ color: 0x8a6040 }), 44, 21.6, 15.5);
    for (var k = 0; k < 6; k++) box(2.6, 0.3, 0.3, steel, 47 + (k % 2) * 0.2, 0.2 + k * 0.32, 13.6);
  })();

  /* ================= South road to the outskirts ================= */
  var ROADX = -5;
  (function () {
    plane(10, 154, M.asphalt, ROADX, 0.015, 11.2 + 77);
    plane(240, 8, M.asphalt, -35, 0.016, 95);
    var dash = canvasTex(64, 256, function (g, w, h) { g.clearRect(0, 0, w, h); g.fillStyle = "#e9e9e3"; g.fillRect(28, 0, 8, h * 0.5); }, true); dash.repeat.set(1, 30);
    var dl = plane(0.25, 150, new THREE.MeshStandardMaterial({ map: dash, transparent: true }), ROADX, 0.02, 12 + 75);
    mapRect(ROADX - 5, ROADX + 5, 11.2, 165, "#25292a"); mapRect(-155, 85, 91, 99, "#25292a");
    for (var z = 40; z < 165; z += 30) { tree(ROADX - 8, z, 1.1); tree(ROADX + 8, z + 14, 1); }
    sign("OUTSKIRTS  \u00b7  FARM  \u00b7  OIL  \u00b7  MINE  \u00b7  FACTORY", 9, 0.9, ROADX + 6.5, 3.6, 38, -Math.PI / 2, { bg: "#0f4d2a", fg: "#ffffff", size: 56, w: 1024, h: 100 });
    box(0.2, 3.2, 0.2, M.dark, ROADX + 6.5, 1.6, 34); box(0.2, 3.2, 0.2, M.dark, ROADX + 6.5, 1.6, 42);
  })();

  /* ================= Farm ================= */
  (function () {
    var soil = new THREE.MeshStandardMaterial({ color: 0x5a4126, roughness: 1 }), crop = new THREE.MeshStandardMaterial({ color: 0x6f9a35, roughness: 0.9, flatShading: true }), wheat = new THREE.MeshStandardMaterial({ color: 0xc9a74a, roughness: 0.9, flatShading: true });
    plane(62, 42, soil, -69, 0.02, 66.5); mapRect(-100, -38, 45.5, 87.5, "#4a3a22");
    for (var i = 0; i < 14; i++) { var row = mesh(new THREE.BoxGeometry(58, 0.7, 1.1, 20, 1, 1), i < 7 ? crop : wheat, -69, 0.35, 48.5 + i * 2.8); row.receiveShadow = true; mapRect(-98, -40, 48 + i * 2.8, 49 + i * 2.8, i < 7 ? "#5d7f2c" : "#a8893c"); }
    var barnM = new THREE.MeshStandardMaterial({ color: 0x9c2a22, roughness: 0.8 }), trimM = M.white;
    box(16, 9, 14, barnM, -26, 4.5, 69); solid(-34, -18, 62, 76, "bld"); MAPB.push({ x1: -34, x2: -18, z1: 62, z2: 76, k: "barn" });
    var rs = new THREE.Shape(); rs.moveTo(-8.6, 0); rs.lineTo(0, 5.5); rs.lineTo(8.6, 0); rs.lineTo(-8.6, 0);
    var rg = new THREE.ExtrudeGeometry(rs, { depth: 14.6, bevelEnabled: false }); rg.translate(0, 0, -7.3);
    var roof = mesh(rg, new THREE.MeshStandardMaterial({ color: 0x3b3b3b, roughness: 0.7 }), -26, 9, 69); roof.rotation.y = Math.PI / 2;
    box(0.2, 6, 5, new THREE.MeshStandardMaterial({ color: 0x6b1d18 }), -17.9, 3, 69); box(0.25, 0.3, 5.4, trimM, -17.8, 6.1, 69); box(0.25, 6, 0.3, trimM, -17.8, 3, 66.4); box(0.25, 6, 0.3, trimM, -17.8, 3, 71.6);
    sign("GREEN ACRES FARM", 7, 0.9, -17.75, 7.6, 69, Math.PI / 2, { bg: "#f4f1ea", fg: "#6b1d18", size: 82, w: 1024, h: 130 });
    mesh(new THREE.CylinderGeometry(3, 3, 14, 20), M.metal, -28, 7, 54); mesh(new THREE.SphereGeometry(3, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.metal, -28, 14, 54); solid(-31, -25, 51, 57, "bld"); MAPB.push({ x1: -31, x2: -25, z1: 51, z2: 57, k: "silo" });
    var tg = new THREE.Group(), tmat = new THREE.MeshStandardMaterial({ color: 0x2f7a2f, roughness: 0.5 });
    var tb = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.2, 1.6), tmat); tb.position.y = 1.3; tg.add(tb);
    var cab = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), carGlass); cab.position.set(-0.6, 2.6, 0); tg.add(cab);
    [[1, 0.6], [-1, 0.95]].forEach(function (p) { [-1, 1].forEach(function (s) { var wh = new THREE.Mesh(new THREE.CylinderGeometry(p[1], p[1], 0.5, 18), tireM); wh.rotation.x = Math.PI / 2; wh.position.set(p[0], p[1], s * 1.05); tg.add(wh); }); });
    tg.position.set(-48, 0, 89.2); tg.traverse(function (o) { if (o.isMesh) o.castShadow = true; }); scene.add(tg); solid(-50, -46, 88, 90.4);
    var fenceW = new THREE.MeshStandardMaterial({ color: 0xd8ccb4, roughness: 0.8 });
    box(62, 0.12, 0.12, fenceW, -69, 0.9, 44.8); box(62, 0.12, 0.12, fenceW, -69, 0.5, 44.8); for (var f = -100; f <= -38; f += 3) box(0.14, 1.1, 0.14, fenceW, f, 0.55, 44.8);
    solid(-100, -38, 44.7, 44.9);
  })();

  /* ================= Oil field ================= */
  (function () {
    var dirt = new THREE.MeshStandardMaterial({ color: 0x6b5b45, roughness: 1 });
    plane(70, 42, dirt, 46, 0.02, 66.5); mapRect(11, 81, 45.5, 87.5, "#4a4032");
    var pj = new THREE.MeshStandardMaterial({ color: 0x2a2d31, roughness: 0.5, metalness: 0.5 }), head = new THREE.MeshStandardMaterial({ color: 0xd6a72a, roughness: 0.5 });
    [[26, 55], [48, 58], [68, 54], [38, 77], [60, 76]].forEach(function (p, i) {
      var x = p[0], z = p[1];
      box(7, 0.4, 2.4, M.curb, x, 0.2, z);
      var a1 = mesh(new THREE.BoxGeometry(0.3, 4.6, 0.3), pj, x, 2.3, z - 0.7); a1.rotation.x = 0.15; var a2 = mesh(new THREE.BoxGeometry(0.3, 4.6, 0.3), pj, x, 2.3, z + 0.7); a2.rotation.x = -0.15;
      var piv = new THREE.Group(); piv.position.set(x, 4.6, z); scene.add(piv);
      var beam = new THREE.Mesh(new THREE.BoxGeometry(7, 0.5, 0.5), pj); beam.castShadow = true; piv.add(beam);
      var hd = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.2, 0.8), head); hd.position.set(3.6, -0.4, 0); hd.castShadow = true; piv.add(hd);
      var cw = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.5, 16), head); cw.rotation.x = Math.PI / 2; cw.position.set(-2.6, -2.4, 0); scene.add(cw); cw.position.add(new THREE.Vector3(x, 4.6, z));
      mesh(new THREE.CylinderGeometry(0.14, 0.14, 3, 8), M.metal, x + 3.6, 1.5, z);
      ANIMS.push(function (t) { piv.rotation.z = Math.sin(t * 1.6 + i) * 0.32; cw.position.y = 2.2 + Math.sin(t * 1.6 + i + 1.6) * 0.5; });
      solid(x - 3.5, x + 3.5, z - 1.2, z + 1.2); MAPB.push({ x1: x - 3.5, x2: x + 3.5, z1: z - 1.2, z2: z + 1.2, k: "rig" });
    });
    [[72, 82], [64, 84]].forEach(function (p) { mesh(new THREE.CylinderGeometry(3.4, 3.4, 6, 24), M.white, p[0], 3, p[1]); solid(p[0] - 3.4, p[0] + 3.4, p[1] - 3.4, p[1] + 3.4, "bld"); MAPB.push({ x1: p[0] - 3.4, x2: p[0] + 3.4, z1: p[1] - 3.4, z2: p[1] + 3.4, k: "tank" }); });
    box(8, 3.6, 8, new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.8 }), 12, 1.8, 70); solid(8, 16, 66, 74, "bld"); MAPB.push({ x1: 8, x2: 16, z1: 66, z2: 74, k: "concrete" });
    box(0.1, 2.4, 1.4, M.dark, 7.95, 1.2, 70, { shadow: false });
    sign("OIL FIELD  \u00b7  CONTROL", 6, 0.8, 7.9, 3.1, 70, -Math.PI / 2, { bg: "#111411", fg: "#d6a72a", size: 80, w: 1024, h: 130 });
  })();

  /* ================= Gold mine ================= */
  (function () {
    var rock = new THREE.MeshStandardMaterial({ color: 0x7a6650, roughness: 1, flatShading: true });
    var hill = mesh(new THREE.DodecahedronGeometry(30, 1), rock, -120, -6, 142); hill.scale.set(1, 0.75, 0.95);
    var hill2 = mesh(new THREE.DodecahedronGeometry(18, 1), rock, -142, -2, 120); hill2.scale.set(1, 0.9, 1);
    solid(-150, -92, 116, 170, "bld"); solid(-158, -128, 104, 134, "bld");
    MAPB.push({ x1: -158, x2: -92, z1: 104, z2: 170, k: "hill" });
    var timber = new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 0.9 });
    box(1, 6, 1, timber, -116, 3, 113.6); box(1, 6, 1, timber, -108, 3, 113.6); box(9.2, 1, 1.2, timber, -112, 6.3, 113.6);
    box(7, 5.4, 3, new THREE.MeshBasicMaterial({ color: 0x050403 }), -112, 2.7, 115.4, { shadow: false });
    sign("GOLD MINE  \u00b7  SHAFT 3", 6, 0.9, -112, 7.4, 112.95, Math.PI, { bg: "#2a1d10", fg: "#e8b84a", size: 80, w: 1024, h: 130 });
    for (var z = 99; z < 114; z += 1.2) box(2.4, 0.12, 0.25, timber, -112, 0.06, z, { shadow: false });
    box(0.1, 0.1, 15, M.metal, -112.7, 0.16, 106.5, { shadow: false }); box(0.1, 0.1, 15, M.metal, -111.3, 0.16, 106.5, { shadow: false });
    var cart = box(2, 1.1, 2.4, new THREE.MeshStandardMaterial({ color: 0x3a3a3a, metalness: 0.6, roughness: 0.5 }), -112, 0.8, 104);
    box(1.8, 0.4, 2.2, new THREE.MeshStandardMaterial({ color: 0xe8b84a, metalness: 0.9, roughness: 0.3, emissive: 0x3a2a00 }), -112, 1.4, 104); solid(-113, -111, 102.8, 105.2);
    ANIMS.push(function (t) { var k = (Math.sin(t * 0.25) + 1) / 2; cart.position.z = 101 + k * 10; });
  })();

  /* ================= Factory + truck depot ================= */
  (function () {
    var wallM = new THREE.MeshStandardMaterial({ color: 0x8e959b, roughness: 0.7, metalness: 0.2 }), roofM = new THREE.MeshStandardMaterial({ color: 0x4a5058, roughness: 0.6, metalness: 0.4 });
    plane(70, 50, M.asphalt, 45, 0.02, 128); mapRect(10, 80, 103, 153, "#2a2e2c");
    box(50, 12, 28, wallM, 45, 6, 126); solid(20, 70, 112, 140, "bld"); MAPB.push({ x1: 20, x2: 70, z1: 112, z2: 140, k: "factory" });
    for (var i = 0; i < 5; i++) { var tri = new THREE.Shape(); tri.moveTo(0, 0); tri.lineTo(10, 0); tri.lineTo(10, 4); tri.lineTo(0, 0); var tg = new THREE.ExtrudeGeometry(tri, { depth: 28, bevelEnabled: false }); var t = mesh(tg, roofM, 20 + i * 10, 12, 112); }
    [[62, 136], [66, 136]].forEach(function (p) { mesh(new THREE.CylinderGeometry(1.2, 1.6, 30, 16), new THREE.MeshStandardMaterial({ color: 0x9a4a3a, roughness: 0.8 }), p[0], 15, p[1]); });
    box(5, 4.4, 0.15, M.dark, 30, 2.2, 111.9, { shadow: false });
    sign("FACTORY  \u00b7  ASSEMBLY LINE", 12, 1.3, 45, 9.4, 111.9, Math.PI, { bg: "#111411", fg: "#ccff00", size: 80, w: 1024, h: 120 });
    var smoke = []; for (var s = 0; s < 8; s++) { var sm = mesh(new THREE.SphereGeometry(1.6, 10, 8), new THREE.MeshStandardMaterial({ color: 0xd9d9d9, transparent: true, opacity: 0.35, depthWrite: false }), 62, 31, 136, true); smoke.push(sm); }
    ANIMS.push(function (t) { smoke.forEach(function (m, i) { var k = ((t * 0.12 + i / smoke.length) % 1); m.position.set(62 + k * 8 + (i % 2) * 4, 31 + k * 18, 136 - k * 3); m.scale.setScalar(0.6 + k * 2.2); m.material.opacity = 0.4 * (1 - k); }); });
    var shedM = new THREE.MeshStandardMaterial({ color: 0x3d4a55, roughness: 0.6, metalness: 0.4 });
    box(30, 0.5, 18, shedM, -55, 7, 115); [[-69.5, 106.5], [-40.5, 106.5], [-69.5, 123.5], [-40.5, 123.5]].forEach(function (p) { box(0.5, 7, 0.5, M.dark, p[0], 3.5, p[1]); solid(p[0] - 0.3, p[0] + 0.3, p[1] - 0.3, p[1] + 0.3); });
    box(30, 7, 0.3, shedM, -55, 3.5, 124); solid(-70, -40, 123.8, 124.2);
    plane(30, 18, new THREE.MeshStandardMaterial({ color: 0x55585c, roughness: 0.9 }), -55, 0.025, 115); mapRect(-70, -40, 106, 124, "#33372f", "rgba(204,255,0,0.6)");
    sign("TRUCK DEPOT  \u00b7  GARAGE", 10, 1.2, -55, 6.2, 105.9, Math.PI, { bg: "#ccff00", fg: "#0b0d0b", size: 80, w: 1024, h: 120 });
  })();
  ZONES.push({ id: "busIn", x: 2.5, z: 101, r: 2 });
  [["man", -20, 72, Math.PI / 2, 0x6b4f2f], ["man", 10, 66, -Math.PI / 2, 0x8a6a2a], ["man", -109, 107.6, Math.PI, 0x4a4a52], ["woman", 34, 110, Math.PI, 0x2f6b4f],
   ["man", -58, 108, Math.PI, 0x1d3f7a], ["man", 50, 15.4, Math.PI, 0xf2a030], ["woman", 56, 20, 0, 0xf2a030], ["man", -131, -10.3, 0, 0x2a1f14],
   ["woman", -138, 10.3, Math.PI, 0xe8e4d8], ["woman", -30, 10.3, Math.PI, 0x6b3a2a], ["officer", 22, -10.3, 0, 0], ["officer", 51, -10.3, 0, 0],
   ["woman", LMX + 32, 6, -Math.PI / 2, 0x7a1d3f], ["man", LMX + 33, -5, -Math.PI / 2, 0x3b5998], ["man", 103, 27.4, Math.PI, 0x13244a]].forEach(function (n) { NPCS.push({ kind: n[0], x: n[1], z: n[2], yaw: n[3], tint: n[4] || undefined, anim: "Idle" }); });
  (function () {
    box(4.2, 0.12, 1.6, M.dark, 2.5, 2.6, 102.3); box(4, 0.1, 0.4, M.wood, 2.5, 0.65, 102.8);
    sign("BUS  \u00b7  CITY CENTRE", 3.6, 0.5, 2.5, 2.95, 101.48, Math.PI, { bg: "#ccff00", fg: "#0b0d0b", size: 80, w: 1024, h: 140 });
  })();

  /* ================= Characters (CC0 Quaternius base characters + UAL animations) ================= */
  var player = null, ACTORS = [], npcSeed = 1000;
  var OFFICER = { sex: "M", skin: 2, hair: "Hair_Buzzed", hairColor: "#1c1512", beard: false, top: "suit", bottom: "slacks", c1: "#13244a", c2: "#0b1630", c3: "#13244a", shoes: "#111111", eye: "#4a2f1f" };
  function makeActor(kind, tint) {
    var tr;
    if (kind && typeof kind === "object") tr = kind;
    else if (kind === "officer") { npcSeed++; tr = Object.assign({}, OFFICER, { skin: npcSeed % 6, sex: npcSeed % 3 ? "M" : "F", hair: npcSeed % 3 ? "Hair_Buzzed" : "Hair_Buns" }); }
    else tr = People.traitsFor(npcSeed++, kind === "woman" ? "F" : kind === "man" ? "M" : null);
    var a = People.create(tr); scene.add(a.g); a.kind = kind; ACTORS.push(a); return a;
  }
  function removeActor(a) { scene.remove(a.g); var i = ACTORS.indexOf(a); if (i >= 0) ACTORS.splice(i, 1); }
  var ANIM_MAP = { Run: "Jog" };
  function blendTo(a, target, dt, speedRatio) { a.play(ANIM_MAP[target] || target, { speed: speedRatio || 1 }); }
  function lookFor(pp) { if (!pp.look) { pp.look = People.traitsFor(pp.id || 1, pp.sex, pp.job && pp.job[1]); save(); } return pp.look; }

  /* ================= Input ================= */
  var keys = {}, joy = { x: 0, y: 0, active: false }, run = false;
  window.addEventListener("keydown", function (e) { keys[e.key.toLowerCase()] = true; if (e.key === "Shift") run = true; if ((e.key === "e" || e.key === "Enter") && !$("prompt").hidden && !$("pB").disabled) $("pB").click(); });
  window.addEventListener("keyup", function (e) { keys[e.key.toLowerCase()] = false; if (e.key === "Shift") run = $("bRun").getAttribute("aria-pressed") === "true"; });
  var joyEl = $("joy"), knob = $("knob"), joyId = null;
  function joyMove(e) {
    var r = joyEl.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, R = r.width / 2 - 14;
    var dx = e.clientX - cx, dy = e.clientY - cy, l = Math.hypot(dx, dy);
    if (l > R) { dx *= R / l; dy *= R / l; }
    knob.style.transform = "translate(" + dx + "px," + dy + "px)";
    joy.x = dx / R; joy.y = dy / R;
  }
  joyEl.addEventListener("pointerdown", function (e) { joyId = e.pointerId; joyEl.setPointerCapture(e.pointerId); joy.active = true; joyMove(e); e.preventDefault(); });
  joyEl.addEventListener("pointermove", function (e) { if (e.pointerId === joyId) joyMove(e); });
  function joyEnd(e) { if (e.pointerId !== joyId) return; joyId = null; joy.active = false; joy.x = joy.y = 0; knob.style.transform = ""; }
  joyEl.addEventListener("pointerup", joyEnd); joyEl.addEventListener("pointercancel", joyEnd);
  $("bRun").addEventListener("click", function () { run = !run; $("bRun").setAttribute("aria-pressed", run ? "true" : "false"); });

  var cam = { yaw: Math.PI * 0.85, pitch: 0.32, dist: 6.2, tdist: 6.2 }, drags = {};
  canvas.addEventListener("pointerdown", function (e) { drags[e.pointerId] = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener("pointermove", function (e) {
    var d = drags[e.pointerId]; if (!d) return;
    var ids = Object.keys(drags);
    if (ids.length >= 2) {
      var a = drags[ids[0]], b = drags[ids[1]], before = Math.hypot(a.x - b.x, a.y - b.y);
      d.x = e.clientX; d.y = e.clientY;
      var after = Math.hypot(drags[ids[0]].x - drags[ids[1]].x, drags[ids[0]].y - drags[ids[1]].y);
      cam.tdist = clamp(cam.tdist * before / Math.max(1, after), 2.4, 16);
      return;
    }
    cam.yaw -= (e.clientX - d.x) * 0.006; cam.pitch = clamp(cam.pitch + (e.clientY - d.y) * 0.004, -0.05, 1.2);
    d.x = e.clientX; d.y = e.clientY;
  });
  function dragEnd(e) { delete drags[e.pointerId]; }
  canvas.addEventListener("pointerup", dragEnd); canvas.addEventListener("pointercancel", dragEnd);
  canvas.addEventListener("wheel", function (e) { cam.tdist = clamp(cam.tdist * (1 + e.deltaY * 0.001), 2.4, 16); e.preventDefault(); }, { passive: false });

  /* ================= UI helpers ================= */
  var toastT = 0;
  function toast(msg) { $("toast").textContent = msg; $("toast").hidden = false; toastT = Date.now() + 3200; }
  function modal(html) { $("sheet").innerHTML = html; $("modal").hidden = false; var c = $("mClose"); if (c) c.addEventListener("click", closeModal); }
  function closeModal() { $("modal").hidden = true; $("sheet").innerHTML = ""; }
  $("modal").addEventListener("click", function (e) { if (e.target === $("modal")) closeModal(); });
  function tok(n) { return Math.round(n).toLocaleString("en-US") + " TOKEN"; }

  /* ================= Passport book ================= */
  function photoSVG(p) {
    var hairShape = ["M30 46 C30 22 70 22 70 46 C70 36 62 30 50 30 C38 30 30 36 30 46Z", "M28 50 C26 20 74 20 72 50 C70 40 64 34 50 33 C36 34 30 40 28 50Z M28 50 C26 64 30 74 32 78 L34 52Z M72 50 C74 64 70 74 68 78 L66 52Z", "M31 44 C33 26 67 26 69 44 L69 40 C64 34 58 36 50 34 C42 36 36 34 31 40Z"][p.style];
    return "<svg viewBox='0 0 100 133' xmlns='http://www.w3.org/2000/svg'><rect width='100' height='133' fill='#d9e7f2'/><path d='M14 133 C16 104 32 96 50 96 C68 96 84 104 86 133Z' fill='" + p.suit + "'/><path d='M42 96 L50 112 L58 96Z' fill='#f4f4f4'/><path d='M48 100 L50 118 L52 100Z' fill='#7a1f2b'/><rect x='43' y='76' width='14' height='22' rx='6' fill='" + p.skin + "'/><ellipse cx='50' cy='56' rx='19' ry='23' fill='" + p.skin + "'/><ellipse cx='31' cy='58' rx='3.5' ry='6' fill='" + p.skin + "'/><ellipse cx='69' cy='58' rx='3.5' ry='6' fill='" + p.skin + "'/><path d='" + hairShape + "' fill='" + p.hair + "'/><ellipse cx='43' cy='57' rx='2.2' ry='2.4' fill='#1d1d24'/><ellipse cx='57' cy='57' rx='2.2' ry='2.4' fill='#1d1d24'/><path d='M39 51 L46 50 M54 50 L61 51' stroke='" + p.hair + "' stroke-width='2' stroke-linecap='round'/><path d='M50 58 L48 66 L52 66' stroke='rgba(0,0,0,0.25)' stroke-width='1.4' fill='none' stroke-linecap='round'/><path d='M44 71 Q50 74 56 71' stroke='#7a3b3b' stroke-width='1.6' fill='none' stroke-linecap='round'/></svg>";
  }
  function check(s) { var w = [7, 3, 1], t = 0; for (var i = 0; i < s.length; i++) { var c = s[i], v = c === "<" ? 0 : /[0-9]/.test(c) ? +c : c.charCodeAt(0) - 55; t += v * w[i % 3]; } return String(t % 10); }
  function mrz(p) {
    var l1 = ("P<USA" + p.last.toUpperCase() + "<<" + p.first.toUpperCase() + "<".repeat(44)).slice(0, 44);
    var dob = String(p.dob[0]).slice(2) + String(p.dob[1]).padStart(2, "0") + String(p.dob[2]).padStart(2, "0"), exp = "361121", no = p.no.padEnd(9, "<").slice(0, 9), opt = "<".repeat(14);
    var l2 = no + check(no) + "USA" + dob + check(dob) + p.sex + exp + check(exp) + opt + check(opt);
    l2 = (l2 + check(no + check(no) + dob + check(dob) + exp + check(exp) + opt + check(opt))).padEnd(44, "<").slice(0, 44);
    return l1 + "<br>" + l2;
  }
  var MON = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"], STC = ["#a3243b", "#1f5aa6", "#2f7a4a", "#7a3fa6", "#a65f1f"];
  function stamps(from, to) {
    var s = "";
    G.stamps.slice(from, to).forEach(function (st, i) {
      var r = rng(hash(st.code + st.t)), col = STC[Math.floor(r() * 5)];
      s += "<div class='stamp" + (r() < 0.4 ? " sq" : "") + "' style='left:" + (6 + (i % 2) * 50 + r() * 6) + "%;top:" + (4 + Math.floor(i / 2) * 58 + r() * 6) + "px;color:" + col + ";transform:rotate(" + ((r() - 0.5) * 30).toFixed(0) + "deg)'>" + (st.kind === "in" ? "ENTRY" : "EXIT") + "<br>" + st.code + "<br>" + st.date + "</div>";
    });
    return s || "<div class='empty'>No stamps yet.<br>Travel abroad to fill this page.</div>";
  }
  var page = 0;
  function openPassport() {
    var p = G.passport, dob = String(p.dob[2]).padStart(2, "0") + " " + MON[p.dob[1] - 1] + " " + p.dob[0];
    modal("<div><div class='eyebrow'>Passport NFT \u00b7 #" + String(p.id).padStart(4, "0") + " of 3,333</div><h2>" + p.first + " " + p.last + "</h2></div>" +
      "<div class='book-wrap'><div class='book closed' id='book'></div></div><div class='pager'><button class='btn ghost' id='pgP' type='button'>Previous</button><button class='btn ghost' id='pgN' type='button'>Open</button></div>" +
      "<dl class='kv'><dt>Job (random at mint)</dt><dd>" + p.job[0] + "</dd><dt>Rarity</dt><dd>" + p.job[1] + "</dd><dt>Pay per shift</dt><dd>" + tok(p.job[4]) + "</dd><dt>Citizenship</dt><dd>United States</dd><dt>Now in</dt><dd>" + here().city + "</dd></dl>" +
      "<div class='row'><button class='btn ghost' id='reroll' type='button'>Sample another passport</button><button class='btn' id='mClose' type='button'>Close</button></div>");
    var leaves = [
      ["<div class='face cover'><div class='t1'>UNITED STATES OF AMERICA</div><svg viewBox='0 0 100 100' fill='none' stroke='currentColor' stroke-width='2.2'><circle cx='50' cy='50' r='38'/><ellipse cx='50' cy='50' rx='16' ry='38'/><path d='M12 50h76M18 30h64M18 70h64'/></svg><div><div class='t2'>PASSPORT</div><div class='t1' style='margin-top:6px'>EARTHPASS</div></div></div>",
       "<div class='face back inside'><div>This passport is your key to the world.<br><br>Work, travel, trade<br>and own land in every country.<br><br>TOKEN #" + String(p.id).padStart(4, "0") + " / 3333</div></div>"],
      ["<div class='face pg'><div class='ttl'><span>PASSPORT</span><span>USA</span></div><div class='data'><div class='photo'>" + photoSVG(p) + "</div><div class='fld'><span>SURNAME</span><b>" + p.last.toUpperCase() + "</b><span>GIVEN NAMES</span><b>" + p.first.toUpperCase() + "</b><span>NATIONALITY</span><b>UNITED STATES</b><span>DATE OF BIRTH</span><b>" + dob + "</b><span>PASSPORT NO.</span><b>" + p.no + "</b></div></div><div class='mrz'>" + mrz(p) + "</div></div>",
       "<div class='face back pg'><div class='ttl'><span>WORK PERMIT</span><span>#" + String(p.id).padStart(4, "0") + "</span></div><span class='rarity' style='background:" + p.job[3] + "'>" + p.job[1].toUpperCase() + "</span><div class='prof'>" + p.job[0] + "</div><div class='fld' style='margin-top:auto'><span>PAY PER SHIFT</span><b>" + p.job[4] + " TOKEN</b><span>PAID WHEN</span><b>WORKING</b></div></div>"],
      ["<div class='face pg'><div class='ttl'><span>VISAS</span><span>1</span></div><div class='stamps'>" + stamps(0, 4) + "</div></div>", "<div class='face back pg'><div class='ttl'><span>VISAS</span><span>2</span></div><div class='stamps'>" + stamps(4, 8) + "</div></div>"]
    ];
    var b = $("book");
    leaves.forEach(function (lf, i) { var el = document.createElement("div"); el.className = "leaf"; el.style.zIndex = 10 - i; el.innerHTML = lf[0] + lf[1]; b.appendChild(el); });
    page = 0;
    function setPage(n) {
      page = clamp(n, 0, 3);
      for (var i = 0; i < b.children.length; i++) { b.children[i].classList.toggle("flipped", i < page); b.children[i].style.zIndex = i < page ? 10 + i : 10 - i; }
      b.classList.toggle("closed", page === 0); $("pgP").disabled = page === 0; $("pgN").disabled = page >= 3; $("pgN").textContent = page === 0 ? "Open" : "Next page";
    }
    setPage(0);
    $("pgN").addEventListener("click", function () { setPage(page + 1); });
    $("pgP").addEventListener("click", function () { setPage(page - 1); });
    $("reroll").addEventListener("click", function () { G.passport = makePassport(1 + Math.floor(Math.random() * 3333)); save(); openPassport(); });
  }
  $("bPass").addEventListener("click", openPassport);

  /* ================= Travel ================= */
  function fees(a, b) { var km = distKm(a, b), intl = a.country !== b.country, t = Math.round(40 + km * 0.09); return { ticket: t, visa: intl ? 60 + (hash(b.country) % 5) * 20 : 0, tax: Math.round(t * (intl ? 0.08 : 0.04)), intl: intl }; }
  function slots() { var t = now(), first = Math.ceil((t + 20 * 60000) / (30 * 60000)) * 30 * 60000, s = []; for (var k = 0; k < 4; k++) s.push(first + k * 90 * 60000); return s; }
  function passHTML(tr) {
    var A = AIR[tr.from], B = AIR[tr.to];
    return "<div class='pass'><div class='main'><div class='brandline'><span>BOARDING PASS</span><em>" + tr.no + "</em></div><div class='route'>" + A.code + " <i>&#9992;</i> " + B.code + "</div><div style='font-size:11px;color:#6b6455'>" + A.city + " to " + B.city + "</div>" +
      "<div class='grid'><div>NAME<b>" + G.passport.last.toUpperCase() + "</b></div><div>GATE<b>B12</b></div><div>SEAT<b>" + tr.seat + "</b></div><div>DEPART<b>" + fmtT(tr.dep, A.tz) + "</b></div></div></div><div class='stub'><div>" + tr.no + "<br>" + tr.seat + "</div><div class='barcode'></div></div></div>";
  }
  function openAgency() {
    var a = here(), pick = G.pick && G.pick !== a.code ? G.pick : (a.us ? "LHR" : "JFK");
    var dests = AP.filter(function (x) { return x !== a; }).sort(function (x, y) { return (x.us === y.us ? 0 : x.us ? -1 : 1) || x.city.localeCompare(y.city); });
    var b = AIR[pick], f = fees(a, b), ss = slots();
    if (G.trip) { modal("<div><div class='eyebrow'>Global Travel</div><h2>You already have a ticket</h2></div>" + passHTML(G.trip) + "<div class='row'><button class='btn ghost' id='cancelT' type='button'>Cancel ticket</button><button class='btn' id='mClose' type='button'>Close</button></div>"); $("cancelT").addEventListener("click", function () { G.trip = null; G.flags = {}; save(); applyBlocks(); refreshSigns(); closeModal(); toast("Ticket cancelled"); }); return; }
    modal("<div><div class='eyebrow'>Global Travel \u00b7 " + a.city + "</div><h2>Where are you flying?</h2></div>" +
      "<label class='f'>Destination<select id='dest'>" + dests.map(function (x) { return "<option value='" + x.code + "'" + (x.code === pick ? " selected" : "") + ">" + x.city + ", " + x.country + " (" + x.code + ")</option>"; }).join("") + "</select></label>" +
      "<label class='f'>Departure, " + a.city + " time<select id='slot'>" + ss.map(function (x) { return "<option value='" + x + "'>" + fmtD(x, a.tz) + "  " + fmtT(x, a.tz) + "</option>"; }).join("") + "</select></label>" +
      "<dl class='kv'><dt>Distance</dt><dd>" + Math.round(distKm(a, b)).toLocaleString("en-US") + " km</dd><dt>Flight time</dt><dd>" + dur(flightMs(a, b)) + "</dd><dt>Ticket</dt><dd>" + tok(f.ticket) + "</dd><dt>Visa</dt><dd>" + (f.intl ? tok(f.visa) : "Not needed") + "</dd><dt>Travel tax</dt><dd>" + tok(f.tax) + "</dd><dt class='tot'>Total</dt><dd class='tot'>" + tok(f.ticket + f.visa + f.tax) + "</dd></dl>" +
      "<div class='row'><button class='btn ghost' id='mClose' type='button'>Not now</button><button class='btn' id='pay' type='button'" + (G.balance < f.ticket + f.visa + f.tax ? " disabled" : "") + ">Pay and book</button></div>" +
      "<p class='note'>" + (G.balance < f.ticket + f.visa + f.tax ? "Not enough TOKEN. Work a shift at Summit Tower first." : "TOKEN is a placeholder name. Prices are samples.") + "</p>");
    $("dest").addEventListener("change", function (e) { G.pick = e.target.value; openAgency(); });
    $("pay").addEventListener("click", function () {
      var B = AIR[$("dest").value], dep = +$("slot").value, f2 = fees(a, B), h = hash(a.code + B.code + dep), total = f2.ticket + f2.visa + f2.tax;
      G.trip = { from: a.code, to: B.code, dep: dep, dur: flightMs(a, B), no: "PW " + (100 + h % 899), seat: (8 + h % 30) + (h % 2 ? "A" : "F"), intl: f2.intl, stage: "booked" };
      spend(total, "Flight " + G.trip.no + " to " + B.city); missionEvent("booked");
      G.flags = {}; G.pick = null; save(); applyBlocks(); refreshSigns();
      modal("<div><div class='eyebrow'>Booked</div><h2>See you at the airport</h2></div>" + passHTML(G.trip) + "<p class='note'>Walk east along Main Street through the tunnel to the airport. Check in, pass security" + (G.trip.intl ? " and passport control" : "") + ", then board at Gate B12. Boarding opens 30 minutes before departure.</p><button class='btn' id='mClose' type='button'>Got it</button>");
    });
  }
  $("bTicket").addEventListener("click", function () {
    if (!G.trip) { modal("<div><div class='eyebrow'>Ticket</div><h2>No ticket yet</h2></div><p class='note'>Book a flight at Global Travel on Main Street.</p><button class='btn' id='mClose' type='button'>Close</button>"); return; }
    var tr = G.trip, A = AIR[tr.from];
    modal("<div><div class='eyebrow'>Your ticket</div><h2>" + A.city + " to " + AIR[tr.to].city + "</h2></div>" + passHTML(tr) + "<dl class='kv'><dt>Departs in</dt><dd>" + dur(tr.dep - now()) + "</dd><dt>Checked in</dt><dd>" + (G.flags.checkin ? "Yes" : "Not yet") + "</dd></dl><button class='btn' id='mClose' type='button'>Close</button>");
  });
  $("bSet").addEventListener("click", function () {
    modal("<div><div class='eyebrow'>Settings</div><h2>Test speed</h2></div><p class='note'>The live game runs in real time. Speed up the clock only to test flights and waiting.</p>" +
      "<select id='spd'><option value='1'>Real time</option><option value='60'>60\u00d7 faster</option><option value='600'>600\u00d7 faster</option></select><button class='btn' id='mClose' type='button'>Done</button>");
    $("spd").value = String(clk.speed); $("spd").addEventListener("change", function (e) { setSpeed(+e.target.value); });
  });

  function applyBlocks() {
    var tr = G.trip, arr = G.arrival;
    var secOpen = arr || !!G.flags.security;
    var immOpen = arr ? !!G.flags.entry || (G.arrivalDomestic) : (!!G.flags.immigration || (tr && !tr.intl && G.flags.security));
    blockSec.on = !secOpen; blockSec.mesh.visible = !secOpen;
    blockImm.on = !immOpen; blockImm.mesh.visible = !immOpen;
  }

  /* ================= Gestures ================= */
  var gesture = null, passportProp = null;
  function doGesture(sec, done, anim, opts) { gesture = Object.assign({ t0: performance.now(), dur: sec * 1000, done: done, anim: anim }, opts || {}); }

  /* ================= Zones ================= */
  function zoneInfo(z) {
    var tr = G.trip, t = now(), a = here();
    if (z.w) {
      if (working) return { t: "On shift \u00b7 " + working.title, d: "Stay here until the shift ends", b: "Working\u2026", off: true };
      var own = z.w.jobs.indexOf(G.passport.job[0]) >= 0;
      return own ? { t: z.w.t, d: "Your job: " + G.passport.job[0] + ". Work a shift for " + G.passport.job[4] + " TOKEN.", b: "Start shift" } : { t: z.w.t, d: "Part-time " + z.w.gig + ". Shift pays " + GIG + " TOKEN.", b: "Work part-time" };
    }
    if (z.id.indexOf("door:") === 0) { var pid = z.id.slice(5), pl0 = pid === "home" ? HOME : cityPlaces[pid]; if (!pl0) return null; return { t: pid === "home" ? "Your " + HOME.name.toLowerCase() : pl0.name, d: pid === "home" ? "Your home in " + CITY_NAME : pl0.fn, b: "Go inside" }; }
    if (z.id.indexOf("exit:") === 0) return { t: "Exit", d: "Back to the street", b: "Leave" };
    switch (z.id) {
      case "homeSofa": return { t: "Sofa", d: P.seat ? "Relaxing at home" : "Sit down and relax", b: P.seat ? "Stand up" : "Sit down" };
      case "homeBed": return { t: "Bed", d: "Take a nap.", b: "Rest" };
      case "homeFridge": return G.food >= 98 ? { t: "Kitchen", d: "You are not hungry.", b: "Eat", off: true } : { t: "Kitchen", d: "Cook a meal at home.", b: "Eat for 6 TOKEN", off: G.balance < 6 };
      case "grocery": return G.food >= 98 ? { t: "Fresh Mart", d: "You are not hungry right now.", b: "Buy food", off: true } : { t: "Fresh Mart", d: "Meal and drink, refills your food bar.", b: "Buy for 15 TOKEN", off: G.balance < 15 };
      case "agency": return { t: "Global Travel", d: G.trip ? "View or cancel your ticket" : "Book flights and visas", b: "Talk to agent" };
      case "diner": return G.food >= 98 ? { t: "Restaurant", d: "You are not hungry right now.", b: "Eat", off: true } : { t: "Restaurant table", d: "Sit down for a full meal.", b: "Eat for 25 TOKEN", off: G.balance < 25 };
      case "police": return { t: "Police HQ", d: "Government jobs are run by the EarthPass team.", b: "Team only", off: true };
      case "busOut": return { t: "Bus stop", d: "Ride to the outskirts: farm, oil field, gold mine, factory", b: "Take the bus \u00b7 3 TOKEN", off: G.balance < 3 };
      case "busIn": return { t: "Bus stop", d: "Ride back to the city centre", b: "Take the bus \u00b7 3 TOKEN", off: G.balance < 3 };
      case "taxi": return { t: "Taxi", d: G.passport.job[0] === "Taxi Driver" ? "You are a taxi driver. Earn per kilometre." : "Drive around the city", b: "Get in and drive" };
      case "cityhall": return { t: "City Hall \u00b7 Land Office", d: "Land ownership opens in the next phase. You will need your passport and TOKEN.", b: "Coming soon", off: true };
      case "tunnel": return { t: "Airport", d: "Walk through the tunnel to the terminal", b: "Go to the airport" };
      case "toCity": return { t: a.city + " city centre", d: "Back to Main Street", b: "Walk to the city" };
      case "checkin":
        if (G.arrival) return null;
        if (!tr) return { t: "Check-in", d: "You need a ticket. Book at Global Travel on Main Street.", b: "No ticket", off: true };
        if (G.flags.checkin) return { t: "Checked in", d: "Go to security", b: "Done", off: true };
        if (tr.dep - t < 0) return { t: "Check-in closed", d: "Your flight has left. Book a new one.", b: "Missed", off: true };
        return { t: "Check-in desk", d: "Hand over your passport to get your boarding pass", b: "Check in" };
      case "security":
        if (G.arrival) return null;
        if (!G.flags.checkin) return { t: "Security", d: "Check in first to get a boarding pass", b: "Closed", off: true };
        if (G.flags.security) return null;
        return { t: "Security check", d: "Scan your passport and walk through the scanner", b: "Scan passport" };
      case "immigration":
        if (G.arrival) { if (G.arrivalDomestic || G.flags.entry) return null; return { t: "Passport control", d: "Show your passport to enter " + a.country, b: "Show passport" }; }
        if (!tr || !tr.intl || !G.flags.security || G.flags.immigration) return null;
        return { t: "Passport control", d: "Exit stamp for " + a.country, b: "Show passport" };
      case "gate":
        if (G.arrival || !tr || !G.flags.security) return null;
        if (tr.intl && !G.flags.immigration) return null;
        var left = tr.dep - t;
        if (left < 0) return { t: "Gate closed", d: "Flight " + tr.no + " has departed.", b: "Book again", miss: true };
        if (left > 30 * 60000) return { t: "Gate B12 \u00b7 " + tr.no, d: "Boarding opens at " + fmtT(tr.dep - 30 * 60000, a.tz) + " (in " + dur(left - 30 * 60000) + ")", b: "Wait", off: true };
        return { t: "Gate B12 \u00b7 Boarding", d: AIR[tr.to].city + " \u00b7 seat " + tr.seat, b: "Board the plane" };
      case "exit": if (!G.arrival) return null; return { t: "Exit", d: "Leave the airport into " + a.city, b: "Exit to " + a.city, off: !(G.arrivalDomestic || G.flags.entry) };
    }
    return null;
  }
  var working = null, GIG = 12;
  function act(z) {
    var tr = G.trip, a = here();
    if (z.w) {
      var own = z.w.jobs.indexOf(G.passport.job[0]) >= 0;
      working = { until: now() + 60000 * clk.speed, start: now(), z: z, pay: own ? G.passport.job[4] : GIG, title: own ? G.passport.job[0] : z.w.gig, place: z.w.id, face: z.face };
      if (z.seat) { sitAt(z.seat); working.seated = true; }
      toast("Shift started as " + working.title + ". Stay for 1 minute."); missionEvent("shiftStart:" + z.w.id); return;
    }
    missionEvent(z.id);
    if (z.id.indexOf("door:") === 0) { enterPlace(z.id.slice(5)); return; }
    if (z.id.indexOf("exit:") === 0) { leavePlace(); return; }
    switch (z.id) {
      case "homeSofa": if (P.seat) standUp(); else sitAt(z.seat); break;
      case "homeBed": fadeTo(function () { G.food = Math.max(0, G.food - 5); toast("You feel rested"); }); break;
      case "homeFridge": spend(6, "Groceries at home"); P.yaw = z.face || 0; doGesture(4, function () { G.food = Math.min(100, G.food + 45); save(); toast("Home-cooked meal \u00b7 \u22126 TOKEN"); missionEvent("ate"); }, "Eat", { passport: false }); break;
      case "diner": sitAt(z.seat); spend(25, "Restaurant meal"); setTimeout(function () { player.play("Eat"); }, 1000); setTimeout(function () { G.food = 100; save(); standUp(); toast("Great meal \u00b7 \u221225 TOKEN"); missionEvent("ate"); }, 7000); break;
      case "busOut": spend(3, "Bus fare"); teleport(2.5, 103, Math.PI); break;
      case "busIn": spend(3, "Bus fare"); (function () { var r = CITY && CITY.nearestRoad(CITY_OX, CITY_OZ, 400); if (r) teleport(r.x + (-r.dz) * (r.road.w / 2 + 2), r.z + r.dx * (r.road.w / 2 + 2), 0); else teleport(-240, 8.4, 0); })(); break;
      case "grocery": doGesture(1.6, function () { spend(15, "Fresh Mart groceries"); G.food = Math.min(100, G.food + 55); save(); toast("Ate a meal \u00b7 \u221215 TOKEN"); missionEvent("ate"); }); break;
      case "agency": openAgency(); break;
      case "taxi": enterTaxi(); break;
      case "tunnel": teleport(AX1 - 6, 8, -Math.PI / 2); break;
      case "toCity": teleport(58, 9, -Math.PI / 2); break;
      case "checkin": checkinSequence(function () { G.flags.checkin = true; save(); applyBlocks(); modal("<div><div class='eyebrow'>Check-in complete</div><h2>Your boarding pass</h2></div>" + passHTML(tr) + "<button class='btn' id='mClose' type='button'>Go to security</button>"); }); break;
      case "security": bodyScan(function () { G.flags.security = true; save(); applyBlocks(); toast("Cleared security"); }); break;
      case "immigration": immigrationSequence(a, G.arrival); break;
      case "gate": var info = zoneInfo(z); if (info && info.miss) { G.trip = null; G.flags = {}; save(); applyBlocks(); refreshSigns(); toast("Ticket expired. Book again at Global Travel."); } else board(); break;
      case "exit": G.arrival = false; G.flags = {}; G.arrivalDomestic = false; save(); applyBlocks(); teleport(AX1 - 6, 8, -Math.PI / 2); toast("Welcome to " + a.city); break;
    }
  }

  /* ================= Player ================= */
  var P = { x: -70, z: 9, yaw: Math.PI, v: 0, mode: "walk" };
  if (G.arrival) { P.x = 154; P.z = 12; P.yaw = -Math.PI / 2; }
  function teleport(x, z, yaw) {
    $("fade").classList.add("on");
    setTimeout(function () { P.x = x; P.z = z; P.yaw = yaw; cam.yaw = yaw + Math.PI; $("fade").classList.remove("on"); }, 600);
  }

  /* taxi */
  var meter = 0;
  var drive = { gas: 0, brake: 0, left: 0, right: 0 };
  function driveUI(on) {
    document.body.classList.toggle("driving", on); $("drive").hidden = !on; $("speedo").hidden = !on;
    drive.gas = drive.brake = drive.left = drive.right = 0;
    ["dL", "dR", "dB", "dG"].forEach(function (id) { $(id).classList.remove("on"); });
  }
  function enterTaxi() {
    P.mode = "car"; player.g.visible = false; taxi.skip = true; taxi.v = 0; taxi.steer = 0; meter = 0;
    cam.tdist = 11; cam.pitch = 0.34; cam.yaw = taxi.yaw - Math.PI / 2;
    $("bRun").textContent = "EXIT"; $("bRun").setAttribute("aria-pressed", "false");
    $("prompt").hidden = true; curZone = null; driveUI(true);
  }
  function exitTaxi() {
    if (Math.abs(taxi.v) > 1.5) { toast("Slow down to stop first"); return; }
    taxi.v = 0; driveUI(false);
    P.mode = "walk"; player.g.visible = true; cam.tdist = 6.2; cam.pitch = 0.32; $("bRun").textContent = "RUN";
    var s = Math.sin(taxi.yaw), c = Math.cos(taxi.yaw);
    P.x = taxi.x + s * 1.9; P.z = taxi.z + c * 1.9; var pq = { x: P.x, z: P.z }; collide(pq, 0.32); P.x = pq.x; P.z = pq.z;
    taxi.skip = false;
    if (meter > 0 && G.passport.job[0] === "Taxi Driver") { var fare = Math.floor(meter / 100) * 2; if (fare > 0) { earn(fare, "Taxi fares"); toast("Fares earned \u00b7 +" + fare + " TOKEN"); } }
    missionEvent("exitTaxi");
  }
  $("bRun").addEventListener("click", function () { if (P.mode === "car") { exitTaxi(); run = false; $("bRun").setAttribute("aria-pressed", "false"); } });
  [["dL", "left"], ["dR", "right"], ["dB", "brake"], ["dG", "gas"]].forEach(function (pr) {
    var el = $(pr[0]), k = pr[1];
    function dn(e) { e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch (x) {} drive[k] = 1; el.classList.add("on"); }
    function upf() { drive[k] = 0; el.classList.remove("on"); }
    el.addEventListener("pointerdown", dn); el.addEventListener("pointerup", upf); el.addEventListener("pointercancel", upf); el.addEventListener("lostpointercapture", upf);
    el.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  });
  /* car body collision: sample points around the taxi's outline */
  function carHits(x, z, yaw) {
    var L = taxi.m.userData.L / 2 - 0.05, W = taxi.m.userData.W / 2 - 0.05, cs = Math.cos(yaw), sn = Math.sin(yaw), n = 0;
    var pts = [[L, W], [L, -W], [-L, W], [-L, -W], [L, 0], [-L, 0], [0, W], [0, -W], [L / 2, W], [L / 2, -W], [-L / 2, W], [-L / 2, -W]];
    for (var i = 0; i < pts.length; i++) {
      var px = x + pts[i][0] * cs + pts[i][1] * sn, pz = z - pts[i][0] * sn + pts[i][1] * cs;
      for (var j = 0; j < COL.length; j++) { var c = COL[j]; if (c.on && px > c.x1 && px < c.x2 && pz > c.z1 && pz < c.z2) { n += 0.05 + Math.min(px - c.x1, c.x2 - px, pz - c.z1, c.z2 - pz); break; } }
      if (CITY && CITY.hit(px, pz, 0)) { var tp = { x: px, z: pz }; CITY.collide(tp, 0.01); n += 0.05 + Math.hypot(tp.x - px, tp.z - pz); }
      for (var k = 0; k < CARS.length; k++) {
        var o = CARS[k]; if (o.skip || o === taxi) continue;
        var oy = o.yaw !== undefined ? o.yaw : (o.dir > 0 ? 0 : Math.PI), oc = Math.cos(oy), os = Math.sin(oy), dx = px - o.x, dz = pz - o.z, lx = Math.abs(dx * oc - dz * os), lz = Math.abs(dx * os + dz * oc), hl = o.m.userData.L / 2 + 0.1, hw = o.m.userData.W / 2 + 0.1;
        if (lx < hl && lz < hw) { n += 0.05 + Math.min(hl - lx, hw - lz); break; }
      }
    }
    return n;
  }

  /* boarding cutscene + flight */
  var cine = null, scanFlash = 0;
  function board() {
    G.trip.stage = "boarded"; save();
    cine = { t0: performance.now(), phase: "walk" };
    $("prompt").hidden = true;
  }
  var JET_PATH = [
    [0, JET_HOME.x, 0, 12, Math.PI, 0],
    [6, JET_HOME.x + 30, 0, 12, Math.PI, 0],
    [10, JET_HOME.x + 52, 0, 26, Math.PI * 0.5 + 0.0, 0],
    [14, JET_HOME.x + 62, 0, 40, 0, 0],
    [16, JET_HOME.x + 75, 0, 40, 0, 0],
    [24, JET_HOME.x + 380, 0, 40, 0, 0],
    [27, JET_HOME.x + 560, 6, 40, 0, 0.12],
    [31, JET_HOME.x + 860, 80, 40, 0, 0.16]
  ];
  function jetAt(t) {
    for (var i = 0; i < JET_PATH.length - 1; i++) {
      var a = JET_PATH[i], b = JET_PATH[i + 1];
      if (t <= b[0]) {
        var k = (t - a[0]) / (b[0] - a[0]), e = i === 4 ? k * k : smooth(k);
        var yawA = a[4], yawB = b[4], dy = ((yawB - yawA + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        return [lerp(a[1], b[1], e), lerp(a[2], b[2], e), lerp(a[3], b[3], e), yawA + dy * e, lerp(a[5], b[5], e)];
      }
    }
    var l = JET_PATH[JET_PATH.length - 1]; return [l[1], l[2], l[3], l[4], l[5]];
  }
  function showFlight() {
    var tr = G.trip; if (!tr) return;
    tr.stage = "inflight"; save();
    $("flight").hidden = false;
    $("fE").textContent = tr.no + " \u00b7 " + tr.from + " to " + tr.to;
    $("fSeat").textContent = tr.seat;
    $("fArr").textContent = fmtT(tr.dep + tr.dur, AIR[tr.to].tz);
  }
  $("fBtn").addEventListener("click", function () {
    var tr = G.trip, B = AIR[tr.to];
    G.city = B.code; G.arrival = true; G.arrivalDomestic = !tr.intl; G.flags = {}; G.trip = null; G.wp = null; G.mis = null; save();
    msg("EarthPass", "Welcome to " + B.city + ", " + B.country + ". " + (tr.intl ? "Go to passport control for your entry stamp." : "Exit the terminal into the city."));
    $("loading").hidden = false; $("lmsg").textContent = "ARRIVING IN " + B.city.toUpperCase(); $("lbar").style.width = "100%";
    setTimeout(function () { location.reload(); }, 400); return;
    $("flight").hidden = true; refreshSigns(); applyBlocks();
    placeJet(JET_HOME.x, 0, JET_HOME.z, JET_HOME.yaw);
    P.x = 154; P.z = 12; P.yaw = -Math.PI / 2; cam.yaw = Math.PI / 2; P.mode = "walk"; player.g.visible = true;
    toast("Welcome to " + B.city + (tr.intl ? " \u00b7 go to passport control" : ""));
  });

  /* window view */
  var clouds = []; (function () { var r = rng(99); for (var i = 0; i < 28; i++) clouds.push({ x: r(), y: r(), s: 0.4 + r() * 1.2, l: Math.floor(r() * 3) }); })();
  function drawWindow(p, dayK, t) {
    var c = $("win"), g = c.getContext("2d"), W = c.width, H = c.height;
    var alt = p < 0 ? 0 : Math.min(1, Math.min(p, 1 - p) / 0.04);
    function mixc(a, b, k) { return "rgb(" + a.map(function (v, i) { return Math.round(v + (b[i] - v) * k); }).join(",") + ")"; }
    g.fillStyle = "#cfd3d6"; g.fillRect(0, 0, W, H);
    var gr0 = g.createLinearGradient(0, 0, W, H); gr0.addColorStop(0, "#e9ebec"); gr0.addColorStop(1, "#b9bec2"); g.fillStyle = gr0; g.fillRect(0, 0, W, H);
    g.save(); g.beginPath(); var rx = W * 0.3, ry = H * 0.4; g.ellipse(W / 2, H / 2, rx, ry, 0, 0, 6.2832); g.clip();
    var sky2 = g.createLinearGradient(0, 0, 0, H);
    sky2.addColorStop(0, mixc([6, 10, 26], [56, 124, 214], dayK)); sky2.addColorStop(0.6, mixc([18, 22, 46], [150, 196, 238], dayK)); sky2.addColorStop(1, mixc([28, 26, 44], [236, 214, 190], dayK * 0.9));
    g.fillStyle = sky2; g.fillRect(0, 0, W, H);
    if (dayK < 0.5) { var sr = rng(5); g.fillStyle = "rgba(255,255,255," + (0.8 * (1 - dayK * 2)) + ")"; for (var i = 0; i < 70; i++) g.fillRect(sr() * W, sr() * H * 0.6, 1.8, 1.8); }
    var hz = H * (0.64 + (1 - alt) * 0.2);
    var gg = g.createLinearGradient(0, hz, 0, H); gg.addColorStop(0, mixc([10, 14, 24], [96, 120, 84], dayK)); gg.addColorStop(1, mixc([6, 8, 14], [58, 78, 50], dayK)); g.fillStyle = gg; g.fillRect(0, hz, W, H - hz);
    clouds.forEach(function (cl) {
      var x = ((cl.x - t / 1000 * 0.02 * (cl.l + 1)) % 1 + 1) % 1, y = alt > 0.6 ? hz + (cl.y * 0.9 - 0.05) * (H - hz) : cl.y * hz, s = cl.s * W * 0.07 * (cl.l + 1);
      g.fillStyle = "rgba(" + (dayK > 0.3 ? "255,255,255," : "150,160,190,") + (0.35 + cl.l * 0.15) + ")"; g.beginPath(); g.ellipse(x * W * 1.3 - W * 0.15, y, s * 1.6, s * 0.45, 0, 0, 6.2832); g.fill();
    });
    g.fillStyle = mixc([24, 26, 32], [232, 234, 236], dayK * 0.85); g.beginPath(); g.moveTo(W * 0.12, H * 0.98); g.lineTo(W * 0.6, H * 0.74); g.lineTo(W * 0.64, H * 0.77); g.lineTo(W * 0.2, H * 1.04); g.fill();
    g.fillStyle = "#ccff00"; g.beginPath(); g.moveTo(W * 0.6, H * 0.74); g.lineTo(W * 0.64, H * 0.77); g.lineTo(W * 0.66, H * 0.7); g.lineTo(W * 0.63, H * 0.69); g.fill();
    if (Math.floor(t / 900) % 2 === 0) { g.fillStyle = "#ff3b3b"; g.beginPath(); g.arc(W * 0.64, H * 0.7, 5, 0, 6.2832); g.fill(); }
    g.restore();
    g.strokeStyle = "#8f969c"; g.lineWidth = 16; g.beginPath(); g.ellipse(W / 2, H / 2, rx + 8, ry + 8, 0, 0, 6.2832); g.stroke();
    var shade = g.createLinearGradient(0, H / 2 - ry - 10, 0, H / 2 - ry + 30); shade.addColorStop(0, "rgba(0,0,0,0.25)"); shade.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = shade; g.fillRect(W / 2 - rx, H / 2 - ry - 10, rx * 2, 40);
  }

  /* ================= Day / night ================= */
  var envDay = 1;
  function updateSky(t) {
    var h = localHour(t, here().tz);
    var el = Math.sin((h - 6) / 12 * Math.PI);
    var day = smooth((el + 0.15) / 0.45), dusk = Math.max(0, 1 - Math.abs(el) / 0.3) * (el > -0.25 ? 1 : 0);
    envDay = day;
    var top = new THREE.Color(0x0a1022).lerp(new THREE.Color(0x3d7fd1), day);
    var mid = new THREE.Color(0x1a2038).lerp(new THREE.Color(0x9cc0e0), day).lerp(new THREE.Color(0xf0a36b), dusk * 0.55);
    var bot = new THREE.Color(0x0c0f16).lerp(new THREE.Color(0xd5dde3), day);
    skyU.top.value.copy(top); skyU.mid.value.copy(mid); skyU.bot.value.copy(bot);
    scene.fog.color.copy(mid);
    hemi.intensity = 0.35 + 0.3 * day; hemi.color.set(0x8fa3d8).lerp(new THREE.Color(0xdfeeff), day);
    sun.intensity = 0.2 + 1.6 * day;
    sun.color.set(0x9fb2ff).lerp(new THREE.Color(0xfff1dc), day).lerp(new THREE.Color(0xffb27a), dusk * 0.5);
    var az = (h / 24) * Math.PI * 2;
    sun.userData.dir = new THREE.Vector3(Math.cos(az) * 0.6, Math.max(0.25, el * 0.9 + 0.2), Math.sin(az) * 0.8 - 0.3).normalize();
    var night = 1 - day;
    nightMats.forEach(function (m) { m.emissiveIntensity = m.map && m.emissiveMap === m.map ? 0.25 + night * 0.9 : night * 1.15; });
    if (CITY) CITY.setNight(night);
    M.bulb.emissiveIntensity = night * 2.2; headM.emissiveIntensity = 0.3 + night * 2.5; tailM.emissiveIntensity = 0.4 + night * 1.6; taxiSignM.emissiveIntensity = 0.3 + night * 1.2; poolMat.opacity = night * 0.9;
    renderer.toneMappingExposure = 0.62 + 0.1 * day;
  }

  /* ================= Departures board ================= */
  var boardCanvas = document.createElement("canvas"); boardCanvas.width = 1024; boardCanvas.height = 576;
  var boardTex = new THREE.CanvasTexture(boardCanvas); boardTex.encoding = THREE.sRGBEncoding;
  function drawBoard(t) {
    var g = boardCanvas.getContext("2d"), a = here();
    g.fillStyle = "#050605"; g.fillRect(0, 0, 1024, 576);
    g.fillStyle = "#ccff00"; g.font = "800 40px Unbounded, sans-serif"; g.fillText("DEPARTURES", 36, 64);
    g.fillStyle = "#ffffff"; g.font = "600 34px 'JetBrains Mono', monospace"; g.textAlign = "right"; g.fillText(fmtT(t, a.tz), 988, 64); g.textAlign = "left";
    var list = AP.filter(function (x) { return x !== a; }).map(function (x, i) { var h = hash(a.code + x.code); var period = (5 + h % 6) * 3600000, off = (h % 300) * 60000; var d = Math.ceil((t - off) / period) * period + off; return { x: x, d: d, no: "PW " + (100 + h % 899) }; });
    if (G.trip && G.trip.from === a.code) list.push({ x: AIR[G.trip.to], d: G.trip.dep, no: G.trip.no, mine: true });
    list.sort(function (p, q) { return p.d - q.d; });
    g.font = "500 30px 'JetBrains Mono', monospace";
    list.slice(0, 8).forEach(function (r, i) {
      var y = 130 + i * 56, left = r.d - t;
      g.fillStyle = i % 2 ? "#0b0d0b" : "#101310"; g.fillRect(24, y - 38, 976, 52);
      g.fillStyle = r.mine ? "#ccff00" : "#ffcf5a"; g.fillText(fmtT(r.d, a.tz), 40, y);
      g.fillStyle = "#ffffff"; g.fillText(r.no, 170, y); g.fillText(r.x.city.toUpperCase().slice(0, 16), 360, y);
      g.fillStyle = left < 30 * 60000 ? "#ccff00" : "#8f998a"; g.fillText(left < 30 * 60000 ? "BOARDING" : "ON TIME", 760, y);
    });
    boardTex.needsUpdate = true;
  }

  /* ================= Pedestrians ================= */
  var walkers = [];
  function spawnWalkers() {
    var r = rng(11);
    var PAL = [0x3b5998, 0x9c2f2f, 0x2f6b4f, 0x6b4f2f, 0x4a4a52, 0x8a6a2a, 0x2a2a2a, 0x5b3b7a, 0xc9a74a, 0x1f6b6b, 0x7a1d3f, 0xe8e4d8, 0x24324a, 0x9a4a3a, 0x556b2f, 0x6a5acd];
    for (var i = 0; i < 6; i++) {
      var kind = i % 2 ? "woman" : "man";
      var a = makeActor(kind, PAL[i % PAL.length]);
      var side = r() < 0.5 ? -1 : 1, z = side * (8.4 + r() * 1.4), x = CITY_X1 + 10 + r() * (CITY_X2 - CITY_X1 - 20);
      walkers.push({ a: a, x: x, z: z, dir: r() < 0.5 ? 1 : -1, sp: 1.25 + r() * 0.35, pause: 0 });
    }
    var r2 = rng(23);
    for (var j = 0; j < 6; j++) {
      var b = makeActor(j % 2 ? "man" : "woman", [0x1d3f7a, 0x7a1d3f, 0x3f7a1d, 0x555555, 0x2b2b2b, 0x7a5a1d][j]);
      walkers.push({ a: b, x: 86 + r2() * 20, z: -6 + r2() * 20, dir: r2() < 0.5 ? 1 : -1, sp: 1.2 + r2() * 0.3, pause: 0, airport: true, x1: 84, x2: 108 });
    }
    for (var k = 0; k < 4; k++) {
      var c = makeActor(k % 2 ? "woman" : "man", PAL[(k * 5 + 3) % PAL.length]);
      walkers.push({ a: c, x: ROADX + (k % 2 ? 6.2 : -6.2), z: 20 + k * 30, dir: k % 2 ? 1 : -1, sp: 1.2 + k * 0.08, pause: 0, axis: "z", x1: 16, x2: 150 });
    }
  }
  function updateWalkers(dt) {
    walkers.forEach(function (w) {
      var x1 = w.x1 !== undefined ? w.x1 : CITY_X1 + 6, x2 = w.x2 !== undefined ? w.x2 : CITY_X2 - 6, zx = w.axis === "z";
      var far = Math.abs(P.x - w.x) + Math.abs(P.z - w.z) > 110;
      if (w.pause > 0) { w.pause -= dt; if (!far) blendTo(w.a, "Idle", dt); }
      else {
        if (zx) w.z += w.dir * w.sp * dt; else w.x += w.dir * w.sp * dt;
        var cur = zx ? w.z : w.x;
        if (cur > x2 || cur < x1) { w.dir *= -1; w.pause = 1 + Math.random() * 3; if (zx) w.z = clamp(w.z, x1, x2); else w.x = clamp(w.x, x1, x2); }
        var dpx = P.x - w.x, dpz = P.z - w.z, ahead = zx ? dpz : dpx, side = zx ? dpx : dpz;
        if (ahead * w.dir > 0 && ahead * w.dir < 1.6 && Math.abs(side) < 0.8) { w.pause = 0.8; }
        if (!far) blendTo(w.a, "Walk", dt, w.sp / 1.35);
      }
      w.a.g.position.set(w.x, w.airport ? 0.05 : zx ? 0.02 : 0.16, w.z);
      w.a.g.rotation.y = zx ? (w.dir > 0 ? 0 : Math.PI) : (w.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    });
  }

  /* ================= Load ================= */
  var staticNpcs = [];
  People.load("assets/people/", function (k) { $("lbar").style.width = (k * 100).toFixed(0) + "%"; }).then(function () {
    $("lmsg").textContent = "BUILDING THE CITY";
    player = makeActor(lookFor(G.passport));
    passportProp = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.012, 0.14), new THREE.MeshStandardMaterial({ color: 0x13244a, roughness: 0.5 }));
    passportProp.visible = false;
    phoneProp = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.15, 0.012), [M.dark, M.dark, M.dark, M.dark, new THREE.MeshStandardMaterial({ color: 0x0b1000, emissive: 0xccff00, emissiveIntensity: 0.5 }), M.dark]);
    phoneProp.visible = false;
    var hand = player.bones.hand_r, hs = hand ? 1 / Math.max(0.0001, hand.getWorldScale(new THREE.Vector3()).x) : 1;
    if (hand) { hand.add(phoneProp); phoneProp.position.set(0.02 * (1 / hs), 0.09 * (1 / hs), 0.03 * (1 / hs)); phoneProp.scale.setScalar(hs); hand.add(passportProp); passportProp.position.copy(phoneProp.position); passportProp.scale.setScalar(hs); }
    NPCS = NPCS.filter(function (n) { return !(n.x > -160 && n.x < 62 && Math.abs(n.z) < 12) && n.x > -250; });
    NPCS.forEach(function (n) { var a = makeActor(n.kind, n.tint); a.g.position.set(n.x, n.kind === "officer" ? 0.05 : 0.16, n.z); a.g.rotation.y = n.yaw; a.play(n.anim || "Idle"); staticNpcs.push(a); });
    spawnWalkers();
    depBoard.material = new THREE.MeshBasicMaterial({ map: boardTex, toneMapped: false }); depBoard2.material = depBoard.material;
    applyBlocks();
    var go = function () {
      refreshSigns();
      $("loading").hidden = true;
      if (G.trip && (G.trip.stage === "boarded" || G.trip.stage === "inflight")) showFlight();
      else toast(G.arrival ? "Arrived in " + here().city + " \u00b7 follow signs to passport control" : "Welcome, " + G.passport.first + ". You are a " + G.passport.job[0] + ".");
    };
    startCity().then(function () { if (document.fonts && document.fonts.load) Promise.all([document.fonts.load("800 40px Unbounded"), document.fonts.load("600 20px 'JetBrains Mono'")]).then(go, go); else go(); });
    last = performance.now();
    requestAnimationFrame(loop);
  }).catch(function (e) { $("lmsg").textContent = "COULD NOT LOAD THE 3D MODELS. REFRESH TO TRY AGAIN."; console.error(e); });
  var WORK_ANIM = { farm: ["Harvest", "Plant", "Water"], mine: ["Chop"], oil: ["Fix"], factory: ["PickUp", "Push"], depot: ["PickUp"], site: ["Push", "PickUp"], crew: ["Talk"], mart: ["PickUp", "Interact"], diner: ["Interact"], cafe: ["Interact"], hospital: ["Talk", "Interact"], school: ["Talk"], bank: ["Talk", "Interact"], hotel: ["Talk"], office: ["SitTalk"], tech: ["Sit"], home: ["Sit"] };

  /* ================= Loop ================= */
  function resize() { var w = window.innerWidth, h = window.innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  window.addEventListener("resize", resize); resize();
  var last = 0, uiT = 0, curZone = null, camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
  function loop(tm) {
    if (window.__pause) { requestAnimationFrame(loop); return; }
    var dt = Math.min(0.05, (tm - last) / 1000); last = tm;
    var t = now();
    var sim = (t - (G.foodT || t)) / 60000;
    if (sim > 0) { G.food = Math.max(0, G.food - sim * 0.25); G.foodT = t; }

    var ix = 0, iz = 0;
    if (keys.w || keys.arrowup) iz -= 1; if (keys.s || keys.arrowdown) iz += 1; if (keys.a || keys.arrowleft) ix -= 1; if (keys.d || keys.arrowright) ix += 1;
    if (joy.active) { ix = joy.x; iz = joy.y; }
    var mag = Math.min(1, Math.hypot(ix, iz));
    var busy = gesture || cine || CUT || !$("modal").hidden || !$("flight").hidden || !$("mapov").hidden || !$("phone").hidden;

    if (P.mode === "car") {
      var gas = drive.gas || keys.w || keys.arrowup ? 1 : 0, brk = drive.brake || keys.s || keys.arrowdown ? 1 : 0;
      var st = (drive.left || keys.a || keys.arrowleft ? 1 : 0) - (drive.right || keys.d || keys.arrowright ? 1 : 0);
      if (busy) { gas = 0; brk = 1; st = 0; }
      if (gas) taxi.v += (taxi.v < 0 ? 14 : 8.5 * (1 - taxi.v / 22)) * dt;
      if (brk) { if (taxi.v > 0.3) taxi.v -= 16 * dt; else taxi.v = Math.max(-6, taxi.v - 4.5 * dt); }
      if (!gas && !brk) { taxi.v *= (1 - dt * 0.6); if (Math.abs(taxi.v) < 0.15) taxi.v = 0; }
      taxi.v = clamp(taxi.v, -6, 20);
      taxi.steer = lerp(taxi.steer, st, Math.min(1, dt * 7));
      var turn = taxi.steer * dt * 1.7 * clamp(taxi.v / 3, -1, 1) / (1 + Math.abs(taxi.v) / 30);
      var ny = taxi.yaw + turn, nx = taxi.x + Math.cos(ny) * taxi.v * dt, nz = taxi.z - Math.sin(ny) * taxi.v * dt;
      var h0 = carHits(taxi.x, taxi.z, taxi.yaw), h1 = carHits(nx, nz, ny);
      if (h1 === 0 || h1 < h0 - 0.001) { meter += Math.hypot(nx - taxi.x, nz - taxi.z); taxi.x = nx; taxi.z = nz; taxi.yaw = ny; }
      else {
        if (carHits(taxi.x, taxi.z, ny) <= h0) taxi.yaw = ny;
        if (Math.abs(taxi.v) > 4) toast("Bump!");
        taxi.v = -taxi.v * 0.2;
      }
      P.x = taxi.x; P.z = taxi.z;
      taxi.m.userData.wheels.forEach(function (w) { if (w.userData.front) w.rotation.y = taxi.steer * 0.45; });
    } else if (P.seat && !working) { if (mag > 0.3 && !busy) standUp(); }
    else if (!busy && !working) {
      if (mag > 0.08) {
        var cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
        var wx = ix * cy + iz * sy, wz = -ix * sy + iz * cy;
        var targetYaw = Math.atan2(wx, wz);
        var dy = ((targetYaw - P.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        P.yaw += dy * Math.min(1, dt * 10);
        var running = (run || mag > 0.92) && G.food > 5;
        var spd = running ? 4.3 : 1.55 * Math.max(0.45, mag);
        P.v = lerp(P.v, spd, Math.min(1, dt * 6));
        var dl = Math.hypot(wx, wz) || 1;
        var pp = { x: P.x + (wx / dl) * P.v * dt, z: P.z + (wz / dl) * P.v * dt };
        var wasIn = CITY && !INSIDE && CITY.hit(P.x, P.z, 0); collide(pp, 0.32); if (CITY && !wasIn) CITY.collide(pp, 0.34); carPush(pp, 0.32);
        var want = P.v * dt, got = Math.hypot(pp.x - P.x, pp.z - P.z);
        if (!INSIDE && want > 0.005 && got < want * 0.25) stuckT += dt; else stuckT = Math.max(0, stuckT - dt * 2);
        P.x = pp.x; P.z = pp.z;
        if (stuckT > 1.2 && (stuckT > 4 || trapped())) { stuckT = 0; unstick(true); }
        blendTo(player, running ? "Run" : "Walk", dt, running ? P.v / 3.6 : P.v / 1.35);
      } else { P.v = lerp(P.v, 0, Math.min(1, dt * 8)); blendTo(player, "Idle", dt); }
    } else if (!working && !gesture && !phoneOpen && !P.seat && !cine && !CUT) { blendTo(player, "Idle", dt); }

    if (working) {
      var tl = working.until - t;
      if (tl <= 0) { var pay = working.pay, wp = working.place; earn(pay, "Shift \u00b7 " + working.title); if (working.seated) standUp(); working = null; toast("Shift done \u00b7 +" + pay + " TOKEN"); missionEvent("shift:" + wp); }
      else if (Math.hypot(P.x - working.z.x, P.z - working.z.z) > 3) { working = null; toast("You left your shift early. No pay."); }
    }

    /* cutscene */
    if (cine) {
      var ct = (tm - cine.t0) / 1000;
      if (cine.phase === "walk") {
        var tx2 = AX2 + 4, tz2 = 12;
        var ddx = tx2 - P.x, ddz = tz2 - P.z, dd = Math.hypot(ddx, ddz);
        if (dd > 0.4 && ct < 6) { P.yaw = Math.atan2(ddx, ddz); P.x += ddx / dd * 1.5 * dt; P.z += ddz / dd * 1.5 * dt; blendTo(player, "Walk", dt, 1); }
        else { $("fade").classList.add("on"); cine.phase = "fade"; cine.t1 = tm; }
      } else if (cine.phase === "fade" && tm - cine.t1 > 700) {
        player.g.visible = false; cine.phase = "taxi"; cine.t2 = tm; $("fade").classList.remove("on");
        $("cine").hidden = false; $("cine").textContent = G.trip.no + " \u00b7 pushback";
      } else if (cine.phase === "taxi") {
        var jt = (tm - cine.t2) / 1000, j = jetAt(jt);
        placeJet(j[0], j[1], j[2], j[3], j[4]);
        $("cine").textContent = G.trip.no + (jt < 6 ? " \u00b7 pushback" : jt < 16 ? " \u00b7 taxiing to runway" : jt < 24 ? " \u00b7 take-off roll" : " \u00b7 lift-off");
        if (jt > 31) { cine = null; $("cine").hidden = true; showFlight(); }
      }
    }

    /* traffic */
    TRAFFIC.forEach(function (c) {
      var ahead = c.vmax;
      TRAFFIC.forEach(function (o) { if (o !== c && o.dir === c.dir) { var gap = (o.x - c.x) * c.dir, need = (o.m.userData.L + c.m.userData.L) / 2 + 2.2; if (gap > 0 && gap < need + 12) ahead = Math.min(ahead, Math.max(0, (gap - need) * 1.5)); } });
      var pg = (P.x - c.x) * c.dir; if (pg > -1 && pg < 12 && Math.abs(P.z - c.z) < 2.4) ahead = Math.min(ahead, (pg - c.m.userData.L / 2 - 1.6) * 2);
      var tg = (taxi.x - c.x) * c.dir; if (tg > 0 && tg < 14 && Math.abs(taxi.z - c.z) < 2.6) ahead = Math.min(ahead, (tg - c.m.userData.L / 2 - taxi.m.userData.L / 2 - 1.2) * 2);
      c.v = lerp(c.v, clamp(ahead, 0, c.vmax), Math.min(1, dt * 2));
      c.x += c.dir * c.v * dt;
      if (c.dir > 0 && c.x > CITY_X2 + 1) c.x = CITY_X1 - 20;
      if (c.dir < 0 && c.x < CITY_X1 - 20) c.x = CITY_X2 + 1;
      c.m.position.set(c.x, 0, c.z); c.m.rotation.y = c.dir > 0 ? 0 : Math.PI;
      c.m.userData.wheels.forEach(function (w) { w.rotation.z -= c.v * dt / c.m.userData.r; });
    });
    taxi.m.position.set(taxi.x, 0, taxi.z); taxi.m.rotation.y = taxi.yaw;
    taxi.m.userData.wheels.forEach(function (w) { w.rotation.z -= taxi.v * dt / taxi.m.userData.r; });

    /* actors */
    updateWalkers(dt);
    player.g.position.set(P.x, P.x > AX1 && P.x < AX2 && Math.abs(P.z) < AZ ? 0.05 : (Math.abs(P.z) > 7 && Math.abs(P.z) < 11.2 ? 0.16 : (P.z < -11 && P.x > -81 && P.x < -41 ? 0.17 : 0.02)), P.z);
    player.g.rotation.y = P.yaw;
    if (working && !gesture) { var wa = WORK_ANIM[working.place] || ["Interact"], wi = Math.floor((now() - working.start) / (9000 * clk.speed)) % wa.length; player.play(wa[wi]); if (working.face !== undefined) P.yaw = working.face; }
    else if (phoneOpen && !gesture && P.mode !== "car") player.play("Phone");
    if (gesture) {
      var gk = (tm - gesture.t0) / gesture.dur;
      player.play(gesture.anim || "Interact", { speed: gesture.speed || 1.2 });
      passportProp.visible = gesture.passport !== false && gk > 0.15 && gk < 0.85;
      if (gk >= 1) { var dn = gesture.done; gesture = null; passportProp.visible = false; player.play("Idle"); if (dn) dn(); }
    }
    ACTORS.forEach(function (a) {
      var d = a === player ? 0 : Math.abs(a.g.position.x - P.x) + Math.abs(a.g.position.z - P.z);
      if (a !== player) a.g.visible = d < 110;
      if (d < 110) { a.skip = (a.skip || 0) + dt; if (d < 40 || a.skip > 0.1) { a.update(a.skip); a.skip = 0; } }
    });
    if (armsUp > 0) poseArmsUp(player, armsUp);
    tickScan(tm);
    if (scanLight) { var sf = (tm - scanFlash) / 1000; scanLight.material.emissiveIntensity = sf < 1.2 ? 2 + Math.sin(sf * 30) : 0.6; scanLight.position.y = sf < 1.2 ? 0.3 + (sf / 1.2) * 2 : 2.3; }

    /* rooms fade */
    ROOMS.forEach(function (r) {
      var inside = P.x > r.x1 && P.x < r.x2 && P.z > r.z1 && P.z < r.z2;
      if (inside !== r.inside) { r.inside = inside; r.meshes.forEach(function (m) { fadeMesh(m, inside ? 0.18 : 1); }); }
    });

    /* zones */
    if (!busy && P.mode === "walk") {
      var best = null, bd = 1e9;
      ZONES.forEach(function (z) { var d = Math.hypot(P.x - z.x, P.z - z.z); if (d < z.r && d < bd) { var inf = zoneInfo(z); if (inf) { bd = d; best = { z: z, i: inf }; } } });
      if (best) {
        var key = best.z.id + best.i.t + best.i.d + best.i.b + !!best.i.off;
        if (!curZone || curZone.key !== key) {
          curZone = { key: key, z: best.z };
          $("pT").textContent = best.i.t; $("pD").textContent = best.i.d; $("pB").textContent = best.i.b; $("pB").disabled = !!best.i.off;
          $("prompt").hidden = false;
        }
      } else if (curZone) { curZone = null; $("prompt").hidden = true; }
    } else if (curZone && P.mode !== "car") { curZone = null; $("prompt").hidden = true; }
    if (P.mode === "car") {
      if (!$("prompt").hidden) $("prompt").hidden = true; curZone = null;
      $("spd").textContent = Math.round(Math.abs(taxi.v) * 3.6); $("gear").textContent = taxi.v < -0.2 ? "R" : Math.abs(taxi.v) < 0.2 ? "P" : "D";
      $("meterT").textContent = G.passport.job[0] === "Taxi Driver" ? "FARE " + (meter / 1000).toFixed(2) + " KM" : "";
    }

    /* camera */
    cam.dist = lerp(cam.dist, cam.tdist, Math.min(1, dt * 6));
    var inAir = P.x > AX1 && P.x < AX2 && Math.abs(P.z) < AZ;
    var dist = cam.dist * (inAir ? 1.15 : 1), pitch = cam.pitch;
    var tgt = new THREE.Vector3(P.x, (P.mode === "car" ? 1.2 : 1.5), P.z);
    if (P.mode === "car" && Object.keys(drags).length === 0) { var want = taxi.yaw - Math.PI / 2; var dyc = ((want - cam.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI; cam.yaw += dyc * Math.min(1, dt * (Math.abs(taxi.v) > 0.5 ? 3 : 1)); }
    tickCut(tm);
    if (camOverride && camOverride.exact) { camera.position.copy(camOverride.pos); camLook.copy(camOverride.look); camera.lookAt(camLook); }
    else if (camOverride) { if (camera.position.distanceTo(camOverride.pos) > 25) { camera.position.copy(camOverride.pos); camLook.copy(camOverride.look); } camera.position.lerp(camOverride.pos, Math.min(1, dt * 4)); camLook.lerp(camOverride.look, Math.min(1, dt * 5)); camera.lookAt(camLook); }
    else if (cine && cine.phase === "taxi") {
      var jp = jet.position;
      var jtt = (tm - cine.t2) / 1000;
      camPos.set(jp.x - (jtt < 16 ? 14 : 26), jp.y + 5 + Math.min(14, jp.y * 0.25), jp.z + (jtt < 16 ? 30 : 34));
      camera.position.lerp(camPos, jtt < 0.1 ? 1 : 0.12); camera.lookAt(jp.x + 8, jp.y + 1, jp.z);
    } else {
      var dxc = Math.sin(cam.yaw) * Math.cos(pitch), dzc = Math.cos(cam.yaw) * Math.cos(pitch), safe = dist;
      for (var st = 1; st <= 16; st++) {
        var f = dist * st / 16, qx = tgt.x + dxc * f, qz = tgt.z + dzc * f, hit = false;
        for (var ci2 = 0; ci2 < COL.length; ci2++) { var cc = COL[ci2]; if (cc.tag === "bld" && qx > cc.x1 - 0.3 && qx < cc.x2 + 0.3 && qz > cc.z1 - 0.3 && qz < cc.z2 + 0.3) { hit = true; break; } }
        if (!hit && CITY && CITY.hit(qx, qz, 0.3)) hit = true;
        if (hit) { safe = Math.max(1.6, f - dist / 16); break; }
      }
      camPos.set(tgt.x + dxc * safe, tgt.y + Math.sin(pitch) * safe + 0.4, tgt.z + dzc * safe);
      camera.position.lerp(camPos, Math.min(1, dt * 10)); camLook.lerp(tgt, Math.min(1, dt * 12)); camera.lookAt(camLook);
    }

    var sd = sun.userData.dir || new THREE.Vector3(0.4, 0.8, 0.3);
    sun.position.set(P.x + sd.x * 120, sd.y * 120, P.z + sd.z * 120); sun.target.position.set(P.x, 0, P.z); sun.target.updateMatrixWorld();
    sky.position.copy(camera.position);
    renderer.render(scene, camera);

    if (tm - uiT > 400) {
      uiT = tm;
      if (cityReady && CITY && CITY.inBounds(P.x, P.z) && P.mode !== "car" && !cine) { G.pos = [Math.round(P.x * 10) / 10, Math.round(P.z * 10) / 10]; if (Math.random() < 0.05) save(); }
      updateSky(t);
      var a = here();
      $("hCity").textContent = (INSIDE ? (INSIDE.id === "home" ? "Home" : cityPlaces[INSIDE.id].name) : P.x > AX1 - 10 ? a.city + " \u00b7 " + a.code : false ? (INSIDE.id === "home" ? "Home" : cityPlaces[INSIDE.id].name) : CITY && CITY.inBounds(P.x, P.z) ? CITY_NAME + (CITY_PREVIEW ? " \u00b7 preview map" : "") : a.city + " \u00b7 Airport Expressway");
      $("hTime").textContent = fmtD(t, a.tz) + " \u00b7 " + fmtT(t, a.tz) + (clk.speed > 1 ? " \u00b7 TEST " + clk.speed + "\u00d7" : "") + (working ? " \u00b7 SHIFT " + Math.ceil((working.until - t) / 1000 / clk.speed) + "s" : "");
      $("hBal").textContent = Math.round(G.balance).toLocaleString("en-US");
      $("hFood").style.width = G.food.toFixed(0) + "%"; $("hFoodBar").classList.toggle("low", G.food < 25);
      if (toastT && Date.now() > toastT) { $("toast").hidden = true; toastT = 0; }
      if (Math.abs(P.x - 120) < 50) drawBoard(t);
      if (tm % 4000 < 420) save();
      if (!$("flight").hidden && G.trip) {
        var tr = G.trip, p = (t - tr.dep) / tr.dur, B = AIR[tr.to];
        $("fH").textContent = p < 0 ? "Seated \u00b7 doors closing" : p < 0.03 ? "Climbing" : p > 0.96 ? "Descending into " + B.city : "Cruising to " + B.city;
        $("fLeftL").textContent = p < 0 ? "Departs in" : "Time left";
        $("fLeft").textContent = dur(p < 0 ? tr.dep - t : (1 - p) * tr.dur);
        $("fP").style.width = clamp(p * 100, 0, 100).toFixed(1) + "%";
        $("fBtn").hidden = p < 1;
        if (p >= 1) $("fH").textContent = "Landed in " + B.city;
      }
    }
    if (!$("flight").hidden && G.trip) {
      var tr2 = G.trip, pp2 = (t - tr2.dep) / tr2.dur;
      var A2 = AIR[tr2.from], B2 = AIR[tr2.to], k2 = clamp(pp2, 0, 1);
      var lonM = A2.lon + (B2.lon - A2.lon) * k2, hUTC = (t / 3600000) % 24, solar = (hUTC + lonM / 15 + 48) % 24;
      drawWindow(pp2, smooth((Math.sin((solar - 6) / 12 * Math.PI) + 0.15) / 0.45), tm);
    }
    if (typeof mapTick === "function") mapTick(tm);
    requestAnimationFrame(loop);
  }

  /* ================= Map + minimap + waypoint ================= */
  var PLACES = [
    { id: "landmark", t: CS.lmName, d: "Famous landmark", b: "LM", c: "#ccff00", x: LMX + 26, z: 0 },
    { id: "hotel", t: "Grand Hotel", d: "Hotel jobs", b: "HT", c: "#d8b46a", x: -134, z: -9.8, lp: "u" },
    { id: "cityhall", t: "City Hall", d: "Land office", b: "CH", c: "#f2efe6", x: -100, z: -9.8, lp: "u" },
    { id: "grocery", t: "Fresh Mart", d: "Food", b: "FM", c: "#7bd88f", x: -70, z: -11.6, lp: "u" },
    { id: "agency", t: "Global Travel", d: "Visas and flights", b: "GT", c: "#5ab0ff", x: -49, z: -11.6 },
    { id: "work", t: "Summit Tower", d: "Office jobs", b: "ST", c: "#c9a7ff", x: -29, z: -9.6, lp: "u" },
    { id: "diner", t: "Sunny Diner", d: "Food and jobs", b: "SD", c: "#ff7a59", x: -5, z: -9.8, lp: "u" },
    { id: "bank", t: "City Bank", d: "Bank jobs", b: "BK", c: "#6fa8ff", x: 19, z: -9.8, lp: "u" },
    { id: "police", t: "Police HQ", d: "Government", b: "PD", c: "#4d7cff", x: 48, z: -9.8, lp: "u" },
    { id: "hospital", t: "City Hospital", d: "Doctors and nurses", b: "HS", c: "#ff5a5a", x: -135, z: 9.8, lp: "d" },
    { id: "school", t: "Central School", d: "Teachers", b: "SC", c: "#b5d86a", x: -100, z: 9.8, lp: "d" },
    { id: "taxi", t: "Taxi Rank", d: "Drive and earn", b: "TX", c: "#f2c230", x: -63.4, z: 18 },
    { id: "cafe", t: "Corner Cafe", d: "Barista jobs", b: "CF", c: "#c08a5a", x: -33, z: 9.8, lp: "d" },
    { id: "bus", t: "Bus Stop", d: "To the outskirts", b: "BS", c: "#ccff00", x: 9, z: 9.4, lp: "d" },
    { id: "tech", t: "Tech Hub", d: "Software jobs", b: "TH", c: "#5ad8d8", x: 25, z: 9.8, lp: "d" },
    { id: "site", t: "Construction Site", d: "Builders", b: "CS", c: "#f2a030", x: 52, z: 9.9 },
    { id: "tunnel", t: "Airport Tunnel", d: "Walk to the terminal", b: "TN", c: "#9aa39a", x: 63, z: 9, lp: "d" },
    { id: "exit", t: "Airport Terminal", d: "Entrance and arrivals", b: "AP", c: "#ccff00", x: 83, z: 0 },
    { id: "checkin", t: "Check-in", d: "Boarding pass", b: "CK", c: "#ccff00", x: 98, z: -13.8, lp: "u" },
    { id: "crew", t: "Crew Room", d: "Pilots and baggage", b: "CR", c: "#9fb3ff", x: 100, z: 27.6, lp: "u" },
    { id: "security", t: "Security", d: "Scan and screening", b: "SE", c: "#ff8a5c", x: 110, z: 0 },
    { id: "immigration", t: "Immigration", d: "Passport control", b: "IM", c: "#ff8a5c", x: 125.8, z: 0, lp: "d" },
    { id: "gate", t: "Gate B12", d: "Boarding", b: "GB", c: "#ccff00", x: 156, z: 12 },
    { id: "farm", t: "Green Acres Farm", d: "Farm jobs", b: "FA", c: "#8fd85a", x: -16.4, z: 69 },
    { id: "oil", t: "Oil Field", d: "Oil jobs", b: "OL", c: "#d6a72a", x: 6.4, z: 70 },
    { id: "mine", t: "Gold Mine", d: "Mining jobs", b: "GM", c: "#e8b84a", x: -112, z: 108.6 },
    { id: "depot", t: "Truck Depot", d: "Drivers and mechanics", b: "DP", c: "#ccff00", x: -55, z: 104.4, lp: "d" },
    { id: "factory", t: "Factory", d: "Factory jobs", b: "FC", c: "#a0a8b0", x: 30, z: 110.4, lp: "d" }
  ];
  var MX1 = -250, MX2 = 620, MZ1 = -160, MZ2 = 175, MS = 3;
  var mapBase = document.createElement("canvas");
  mapBase.width = (MX2 - MX1) * MS; mapBase.height = (MZ2 - MZ1) * MS;
  (function () {
    var c = mapBase.getContext("2d");
    c.setTransform(MS, 0, 0, MS, -MX1 * MS, -MZ1 * MS);
    function R(x1, x2, z1, z2, col) { c.fillStyle = col; c.fillRect(Math.min(x1, x2), Math.min(z1, z2), Math.abs(x2 - x1), Math.abs(z2 - z1)); }
    R(MX1, MX2, MZ1, MZ2, "#0f1a10");
    for (var i = 0; i < 260; i++) { var rx = MX1 + ((i * 977) % (MX2 - MX1)), rz = MZ1 + ((i * 613) % (MZ2 - MZ1)); c.fillStyle = "rgba(30,52,28,0.55)"; c.beginPath(); c.arc(rx, rz, 3 + (i % 5), 0, 7); c.fill(); }
    R(AX2, MX2, -150, 150, "#24262a");
    R(AX2 + 40, MX2, 17, 63, "#303338");
    c.fillStyle = "#e9ece6"; for (var rx2 = AX2 + 50; rx2 < MX2; rx2 += 18) c.fillRect(rx2, 39.6, 9, 0.8);
    R(AX2 + 40, MX2, 17.6, 18, "#e9ece6"); R(AX2 + 40, MX2, 62, 62.4, "#e9ece6");
    R(AX2, MX2, 11.7, 12.3, "#d8b12a");
    R(CITY_X1 - 42, CITY_X2 + 18, -11.2, 11.2, "#3b403a");
    R(CITY_X1 - 42, CITY_X2 + 18, -7, 7, "#25292a");
    c.fillStyle = "#d8b12a"; c.fillRect(CITY_X1 - 42, -0.35, CITY_X2 - CITY_X1 + 60, 0.7);
    c.fillStyle = "rgba(240,240,235,0.6)"; for (var dx = CITY_X1 - 40; dx < CITY_X2 + 16; dx += 6) { c.fillRect(dx, -3.7, 3, 0.25); c.fillRect(dx, 3.5, 3, 0.25); }
    R(64, 80, -30, 30, "#3b403a");
    R(-79, -47, 11.2, 29.2, "#2a2e2c");
    c.fillStyle = "rgba(240,240,235,0.55)"; for (var pk = 0; pk < 6; pk++) c.fillRect(-76 + pk * 5.2 - 0.1, 14.1, 0.2, 5);
    R(66, 68, -17, 17, "#5d5a52");
    R(AX1, AX2, -AZ, AZ, "#1b2433");
    c.strokeStyle = "#ccff00"; c.lineWidth = 0.7; c.strokeRect(AX1, -AZ, AX2 - AX1, AZ * 2);
    c.fillStyle = "#26324a"; c.fillRect(AX1, -27.5, AX2 - AX1, 7);
    R(AX2, AX2 + 22, 10.5, 13.5, "#4a5160");
    MAPR.forEach(function (q) { R(q.x1, q.x2, q.z1, q.z2, q.c); if (q.l) { c.strokeStyle = q.l; c.lineWidth = 0.5; c.strokeRect(q.x1, q.z1, q.x2 - q.x1, q.z2 - q.z1); } });
    MAPB.forEach(function (b) {
      var col = { glass: "#26333b", brick: "#3a2b26", stone: "#3a3832", shop: "#33402a", landmark: "#2c3a1a", barn: "#5a1f1a", silo: "#5d6166", rig: "#2a2d31", tank: "#6d7075", factory: "#3d444b", hill: "#5a4a38" }[b.k] || "#30332f";
      R(b.x1, b.x2, b.z1, b.z2, col);
      c.strokeStyle = b.k === "shop" || b.k === "landmark" ? "rgba(204,255,0,0.75)" : "rgba(255,255,255,0.16)"; c.lineWidth = 0.5; c.strokeRect(b.x1, b.z1, b.x2 - b.x1, b.z2 - b.z1);
      c.fillStyle = "rgba(0,0,0,0.35)"; c.fillRect(b.x1 + 1, b.z2, b.x2 - b.x1, 0.9);
    });
    c.fillStyle = "rgba(255,255,255,0.5)"; c.font = "700 3px Manrope, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText(CS.street, -130, -1.6); c.fillText(CS.street, -60, -1.6); c.fillText("OUTSKIRTS RD", ROADX, 60); c.fillText("RUNWAY 09 / 27", AX2 + 120, 30); c.fillText("TERMINAL", 120, 24);
  })();

  var wpMesh = (function () {
    var g = new THREE.Group();
    var col = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 70, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xccff00, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    col.position.y = 35; g.add(col);
    var ring = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.6, 40), new THREE.MeshBasicMaterial({ color: 0xccff00, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.08; g.add(ring);
    g.userData.ring = ring; g.visible = false; scene.add(g); return g;
  })();
  function setWaypoint(x, z, label) {
    G.wp = { x: x, z: z, t: label || "Waypoint" }; save();
    wpMesh.position.set(x, 0, z); wpMesh.visible = true; toast("Waypoint set \u00b7 " + G.wp.t);
  }
  function clearWaypoint() { G.wp = null; save(); wpMesh.visible = false; $("wpChip").hidden = true; }
  if (G.wp) { wpMesh.position.set(G.wp.x, 0, G.wp.z); wpMesh.visible = true; }
  $("wpClear").addEventListener("click", clearWaypoint);

  function headingVec() { return P.mode === "car" ? { x: Math.cos(taxi.yaw), z: -Math.sin(taxi.yaw) } : { x: Math.sin(P.yaw), z: Math.cos(P.yaw) }; }
  function arrow(c, x, y, ang, s) {
    c.save(); c.translate(x, y); c.rotate(ang);
    c.beginPath(); c.moveTo(0, -s); c.lineTo(s * 0.72, s * 0.8); c.lineTo(0, s * 0.38); c.lineTo(-s * 0.72, s * 0.8); c.closePath();
    c.fillStyle = "#ccff00"; c.strokeStyle = "#0b0d0b"; c.lineWidth = 2; c.fill(); c.stroke(); c.restore();
  }
  function badge(c, x, y, p, r) {
    c.beginPath(); c.arc(x, y, r, 0, 7); c.fillStyle = p.c; c.fill(); c.lineWidth = 2; c.strokeStyle = "#0b0d0b"; c.stroke();
    c.fillStyle = "#0b0d0b"; c.font = "800 " + Math.round(r * 0.82) + "px Unbounded, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(p.b, x, y + 0.5);
  }
  function wpPin(c, x, y, r) {
    c.beginPath(); c.arc(x, y, r, 0, 7); c.fillStyle = "rgba(204,255,0,0.25)"; c.fill();
    c.beginPath(); c.arc(x, y, r * 0.5, 0, 7); c.fillStyle = "#ccff00"; c.fill(); c.lineWidth = 2; c.strokeStyle = "#0b0d0b"; c.stroke();
  }

  /* Minimap: rotates with the camera so "up" is the way you are looking */
  var mini = $("mini"), mctx = mini.getContext("2d"), miniT = 0;
  function drawMini() {
    var W = mini.width, H = mini.height, cx = W / 2, cy = H / 2, sc = 2.3 * (W / 264), rot = cam.yaw;
    mctx.setTransform(1, 0, 0, 1, 0, 0); mctx.clearRect(0, 0, W, H);
    mctx.save(); mctx.beginPath(); mctx.arc(cx, cy, W / 2 - 1, 0, 7); mctx.clip();
    mctx.fillStyle = "#0b0d0b"; mctx.fillRect(0, 0, W, H);
    mctx.translate(cx, cy); mctx.rotate(rot); mctx.scale(sc / MS, sc / MS); mctx.translate((MX1 - P.x) * MS, (MZ1 - P.z) * MS);
    if (cityCanvas) mctx.drawImage(cityCanvas, (CITY_OX - cityHalf - MX1) * MS, (CITY_OZ - cityHalf - MZ1) * MS, cityCanvas.width * MS / CMS, cityCanvas.height * MS / CMS);
    mctx.drawImage(mapBase, 0, 0);
    mctx.setTransform(1, 0, 0, 1, 0, 0);
    function toS(x, z) { var dx = (x - P.x) * sc, dz = (z - P.z) * sc, cr = Math.cos(rot), sr = Math.sin(rot); return { x: cx + dx * cr - dz * sr, y: cy + dx * sr + dz * cr }; }
    PLACES.forEach(function (p) { var s = toS(p.x, p.z); if (Math.hypot(s.x - cx, s.y - cy) < W / 2 - 14) badge(mctx, s.x, s.y, p, 11 * (W / 264)); });
    if (G.wp) {
      var s = toS(G.wp.x, G.wp.z), dd = Math.hypot(s.x - cx, s.y - cy), lim = W / 2 - 14;
      if (dd > lim) { s.x = cx + (s.x - cx) / dd * lim; s.y = cy + (s.y - cy) / dd * lim; }
      wpPin(mctx, s.x, s.y, 12 * (W / 264));
    }
    var hv = headingVec(), hs = toS(P.x + hv.x, P.z + hv.z);
    arrow(mctx, cx, cy, Math.atan2(hs.x - cx, -(hs.y - cy)), 13 * (W / 264));
    mctx.restore();
    var nS = toS(P.x, P.z - 1000), nd = Math.hypot(nS.x - cx, nS.y - cy), nx = cx + (nS.x - cx) / nd * (W / 2 - 14), ny = cy + (nS.y - cy) / nd * (W / 2 - 14);
    mctx.beginPath(); mctx.arc(nx, ny, 12, 0, 7); mctx.fillStyle = "#0b0d0b"; mctx.fill(); mctx.lineWidth = 2; mctx.strokeStyle = "#ccff00"; mctx.stroke();
    mctx.fillStyle = "#ccff00"; mctx.font = "800 12px Unbounded, sans-serif"; mctx.textAlign = "center"; mctx.textBaseline = "middle"; mctx.fillText("N", nx, ny + 0.5);
  }

  /* Full-screen map */
  var big = $("bigmap"), bctx = big.getContext("2d"), MV = { x: 0, z: 0, s: 3 }, sel = null;
  function fitBig() { var r = big.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1); big.width = Math.round(r.width * d); big.height = Math.round(r.height * d); }
  function b2w(px, py) { var d = big.width / big.getBoundingClientRect().width; return { x: MV.x + (px * d - big.width / 2) / (MV.s * d), z: MV.z + (py * d - big.height / 2) / (MV.s * d) }; }
  function drawBig() {
    var W = big.width, H = big.height, d = W / Math.max(1, big.getBoundingClientRect().width), s = MV.s * d;
    bctx.setTransform(1, 0, 0, 1, 0, 0); bctx.fillStyle = "#070907"; bctx.fillRect(0, 0, W, H);
    bctx.save(); bctx.translate(W / 2, H / 2); bctx.scale(s / MS, s / MS); bctx.translate((MX1 - MV.x) * MS, (MZ1 - MV.z) * MS);
    bctx.imageSmoothingEnabled = true; if (cityCanvas) bctx.drawImage(cityCanvas, (CITY_OX - cityHalf - MX1) * MS, (CITY_OZ - cityHalf - MZ1) * MS, cityCanvas.width * MS / CMS, cityCanvas.height * MS / CMS); bctx.drawImage(mapBase, 0, 0); bctx.restore();
    function toS(x, z) { return { x: W / 2 + (x - MV.x) * s, y: H / 2 + (z - MV.z) * s }; }
    bctx.font = "700 " + Math.round(12 * d) + "px Manrope, sans-serif"; bctx.textBaseline = "middle"; bctx.textAlign = "left";
    PLACES.forEach(function (p) {
      var q = toS(p.x, p.z), r = 13 * d;
      if (sel === p) { bctx.beginPath(); bctx.arc(q.x, q.y, r + 6 * d, 0, 7); bctx.fillStyle = "rgba(204,255,0,0.25)"; bctx.fill(); }
      badge(bctx, q.x, q.y, p, r);
      if (MV.s > 2.2 || sel === p) {
        bctx.font = "700 " + Math.round(12 * d) + "px Manrope, sans-serif"; bctx.textAlign = "left";
        var tw = bctx.measureText(p.t).width, lx = q.x + r + 4 * d, ly = q.y;
        if (p.lp === "u") { lx = q.x - (tw + 12 * d) / 2; ly = q.y - r - 14 * d; } else if (p.lp === "d") { lx = q.x - (tw + 12 * d) / 2; ly = q.y + r + 14 * d; }
        bctx.fillStyle = "rgba(7,9,7,0.82)"; bctx.fillRect(lx, ly - 10 * d, tw + 12 * d, 20 * d);
        bctx.fillStyle = "#f1f4ee"; bctx.fillText(p.t, lx + 6 * d, ly + 0.5);
      }
    });
    if (G.wp) { var w = toS(G.wp.x, G.wp.z); wpPin(bctx, w.x, w.y, 16 * d); }
    var hv = headingVec(), me = toS(P.x, P.z);
    bctx.beginPath(); bctx.arc(me.x, me.y, 22 * d, 0, 7); bctx.fillStyle = "rgba(204,255,0,0.16)"; bctx.fill();
    arrow(bctx, me.x, me.y, Math.atan2(hv.x, -hv.z), 14 * d);
    var bar = 50 * s, bx = W - 16 * d - bar, by = H - 18 * d;
    bctx.fillStyle = "rgba(7,9,7,0.78)"; bctx.fillRect(bx - 10 * d, by - 22 * d, bar + 20 * d, 34 * d);
    bctx.fillStyle = "#ccff00"; bctx.fillRect(bx, by, bar, 3 * d);
    bctx.fillStyle = "rgba(241,244,238,0.85)"; bctx.font = "600 " + Math.round(11 * d) + "px JetBrains Mono, monospace"; bctx.textAlign = "center";
    bctx.fillText("50 m   \u00b7   N \u2191", bx + bar / 2, by - 9 * d);
  }
  /* ---------- world map ---------- */
  var mapMode = "city", WORLD = null, WPATH = null, WV = { lon: 0, lat: 20, s: 3 }, wsel = null;
  fetch("assets/world.json").then(function (r) { return r.json(); }).then(function (d) {
    WORLD = d; WPATH = new Path2D();
    d.forEach(function (c) { c.r.forEach(function (ring) {
      var mn = 999, mx = -999; for (var j = 0; j < ring.length; j += 2) { mn = Math.min(mn, ring[j]); mx = Math.max(mx, ring[j]); }
      [0, mx > 180 ? -360 : null, mn < -180 ? 360 : null].forEach(function (o) { if (o === null) return; WPATH.moveTo(ring[0] + o, -ring[1]); for (var i = 2; i < ring.length; i += 2) WPATH.lineTo(ring[i] + o, -ring[i + 1]); WPATH.closePath(); });
    }); });
    if (!$("mapov").hidden && mapMode === "world") drawBig();
  }).catch(function () {});
  function gcPoint(A, B, k) {
    var p1 = A.lat * D2R, l1 = A.lon * D2R, p2 = B.lat * D2R, l2 = B.lon * D2R;
    var x1 = Math.cos(p1) * Math.cos(l1), y1 = Math.cos(p1) * Math.sin(l1), z1 = Math.sin(p1), x2 = Math.cos(p2) * Math.cos(l2), y2 = Math.cos(p2) * Math.sin(l2), z2 = Math.sin(p2);
    var d = Math.acos(clamp(x1 * x2 + y1 * y2 + z1 * z2, -1, 1)); if (d < 1e-6) return { lat: A.lat, lon: A.lon };
    var a = Math.sin((1 - k) * d) / Math.sin(d), b = Math.sin(k * d) / Math.sin(d), x = a * x1 + b * x2, y = a * y1 + b * y2, z = a * z1 + b * z2;
    return { lat: Math.atan2(z, Math.hypot(x, y)) / D2R, lon: Math.atan2(y, x) / D2R };
  }
  function w2s(lon, lat, W, H, d) { return { x: W / 2 + (lon - WV.lon) * WV.s * d, y: H / 2 - (lat - WV.lat) * WV.s * d }; }
  function drawWorld() {
    var W = big.width, H = big.height, d = W / Math.max(1, big.getBoundingClientRect().width), s = WV.s * d, t = now();
    bctx.setTransform(1, 0, 0, 1, 0, 0); bctx.fillStyle = "#071016"; bctx.fillRect(0, 0, W, H);
    bctx.strokeStyle = "rgba(204,255,0,0.06)"; bctx.lineWidth = 1;
    for (var gl = -180; gl <= 180; gl += 30) { var a1 = w2s(gl, 85, W, H, d), a2 = w2s(gl, -85, W, H, d); bctx.beginPath(); bctx.moveTo(a1.x, a1.y); bctx.lineTo(a2.x, a2.y); bctx.stroke(); }
    for (var gt = -60; gt <= 60; gt += 30) { var b1 = w2s(-180, gt, W, H, d), b2 = w2s(180, gt, W, H, d); bctx.beginPath(); bctx.moveTo(b1.x, b1.y); bctx.lineTo(b2.x, b2.y); bctx.stroke(); }
    if (WPATH) {
      bctx.save(); bctx.setTransform(s, 0, 0, s, W / 2 - WV.lon * s, H / 2 + WV.lat * s);
      bctx.fillStyle = "#16261a"; bctx.fill(WPATH); bctx.lineWidth = 0.9 / s; bctx.strokeStyle = "rgba(204,255,0,0.35)"; bctx.stroke(WPATH);
      bctx.restore();
    } else { bctx.fillStyle = "#9aa392"; bctx.font = "600 " + Math.round(13 * d) + "px Manrope, sans-serif"; bctx.textAlign = "center"; bctx.fillText("Loading the world map\u2026", W / 2, H / 2); }
    var tr = G.trip;
    if (tr && AIR[tr.from] && AIR[tr.to]) {
      var A = AIR[tr.from], B = AIR[tr.to]; bctx.setLineDash([6 * d, 6 * d]); bctx.strokeStyle = "#ccff00"; bctx.lineWidth = 2 * d; bctx.beginPath();
      for (var i = 0; i <= 64; i++) { var q = gcPoint(A, B, i / 64), sp = w2s(q.lon, q.lat, W, H, d); if (i) bctx.lineTo(sp.x, sp.y); else bctx.moveTo(sp.x, sp.y); }
      bctx.stroke(); bctx.setLineDash([]);
      var pk = clamp((t - tr.dep) / tr.dur, 0, 1), pos = gcPoint(A, B, pk), nx = gcPoint(A, B, Math.min(1, pk + 0.01)), ps = w2s(pos.lon, pos.lat, W, H, d), ns = w2s(nx.lon, nx.lat, W, H, d);
      if (t > tr.dep) { bctx.save(); bctx.translate(ps.x, ps.y); bctx.rotate(Math.atan2(ns.y - ps.y, ns.x - ps.x)); bctx.fillStyle = "#ccff00"; bctx.beginPath(); bctx.moveTo(12 * d, 0); bctx.lineTo(-8 * d, -9 * d); bctx.lineTo(-4 * d, 0); bctx.lineTo(-8 * d, 9 * d); bctx.closePath(); bctx.fill(); bctx.restore(); }
    }
    bctx.textBaseline = "middle";
    AP.forEach(function (a) {
      var q = w2s(a.lon, a.lat, W, H, d), me = a.code === G.city, on = wsel === a;
      if (me) { bctx.beginPath(); bctx.arc(q.x, q.y, (12 + 4 * Math.sin(performance.now() / 300)) * d, 0, 7); bctx.fillStyle = "rgba(204,255,0,0.25)"; bctx.fill(); }
      bctx.beginPath(); bctx.arc(q.x, q.y, (me || on ? 6 : 4) * d, 0, 7); bctx.fillStyle = me ? "#ccff00" : on ? "#ffffff" : "#e9ece6"; bctx.fill(); bctx.lineWidth = 2 * d; bctx.strokeStyle = "#071016"; bctx.stroke();
      if (WV.s > 2.6 || me || on) {
        bctx.font = "700 " + Math.round(11 * d) + "px Manrope, sans-serif"; bctx.textAlign = "left";
        var lab = a.city + (WV.s > 5 ? " \u00b7 " + a.code : ""), tw = bctx.measureText(lab).width;
        bctx.fillStyle = "rgba(7,16,22,0.8)"; bctx.fillRect(q.x + 8 * d, q.y - 9 * d, tw + 10 * d, 18 * d);
        bctx.fillStyle = me ? "#ccff00" : "#f1f4ee"; bctx.fillText(lab, q.x + 13 * d, q.y + 0.5);
      }
    });
  }
  function worldCard(a) {
    var c = $("wcard"); if (!a) { c.hidden = true; return; }
    var h0 = here(), same = a.code === h0.code, km = Math.round(distKm(h0, a)), intl = a.country !== h0.country;
    c.innerHTML = "<b>" + a.city + " \u00b7 " + a.code + "</b><span>" + a.country + " \u00b7 " + a.name + "</span><span>Local time " + fmtT(now(), a.tz) + (same ? " \u00b7 You are here" : " \u00b7 " + km.toLocaleString("en-US") + " km \u00b7 about " + dur(flightMs(h0, a)) + " flight" + (intl ? " \u00b7 visa needed" : "")) + "</span>" +
      (same ? "" : "<div class='row2'><button class='btn' type='button' id='wcGo'>Book at Global Travel</button><button class='btn ghost' type='button' id='wcX'>Close</button></div>");
    c.hidden = false;
    if (!same) { $("wcGo").addEventListener("click", function () { closeMap(); setWaypoint(-49, -12.6, "Global Travel"); G.pick = a.code; save(); toast("Go to Global Travel to book " + a.city); }); $("wcX").addEventListener("click", function () { wsel = null; worldCard(null); drawBig(); }); }
  }
  function setMapMode(m) {
    mapMode = m; $("tCity").setAttribute("aria-pressed", m === "city" ? "true" : "false"); $("tWorld").setAttribute("aria-pressed", m === "world" ? "true" : "false");
    $("mapCity").textContent = m === "city" ? here().city.toUpperCase() + " \u00b7 CITY MAP" : "WORLD MAP";
    $("mapHint").textContent = m === "city" ? "Tap a place or anywhere on the map to set a waypoint" : "Tap an airport to see local time, distance and flight time";
    wsel = null; worldCard(null);
    if (m === "world") { var h0 = here(); WV.lon = h0.lon; WV.lat = h0.lat; WV.s = clamp(big.getBoundingClientRect().width / 140, 2, 6); if (G.trip && G.trip.stage === "inflight") { var A = AIR[G.trip.from], B = AIR[G.trip.to], q = gcPoint(A, B, clamp((now() - G.trip.dep) / G.trip.dur, 0, 1)); WV.lon = q.lon; WV.lat = q.lat; } }
    buildLegend(); drawBig();
  }
  $("tCity").addEventListener("click", function () { setMapMode("city"); });
  $("tWorld").addEventListener("click", function () { setMapMode("world"); });
  var drawCity = drawBig;
  drawBig = function () { if (mapMode === "world") drawWorld(); else drawCity(); };

  function buildLegend() {
    var L = $("legend"); L.innerHTML = "";
    if (mapMode === "world") {
      AP.forEach(function (a) {
        var b = document.createElement("button"); b.type = "button";
        b.innerHTML = "<em style='background:" + (a.code === G.city ? "#ccff00" : "#e9ece6") + "'>" + a.code.slice(0, 2) + "</em>" + a.city;
        b.setAttribute("aria-pressed", wsel === a ? "true" : "false");
        b.addEventListener("click", function () { wsel = a; WV.lon = a.lon; WV.lat = a.lat; WV.s = Math.max(WV.s, 4); worldCard(a); buildLegend(); drawBig(); });
        L.appendChild(b);
      });
      return;
    }
    PLACES.forEach(function (p) {
      var b = document.createElement("button"); b.type = "button";
      b.innerHTML = "<em style='background:" + p.c + "'>" + p.b + "</em>" + p.t;
      b.setAttribute("aria-pressed", sel === p ? "true" : "false");
      b.addEventListener("click", function () { sel = p; MV.x = p.x; MV.z = p.z; MV.s = Math.max(MV.s, 3.2); setWaypoint(p.x, p.z, p.t); buildLegend(); drawBig(); });
      L.appendChild(b);
    });
  }
  function openMap(mode) {
    $("mapov").hidden = false; fitBig(); MV.x = P.x; MV.z = P.z; MV.s = clamp(big.getBoundingClientRect().width / 110, 3.4, 5); sel = null;
    setMapMode(mode === "world" ? "world" : "city");
  }
  function closeMap() { $("mapov").hidden = true; worldCard(null); }
  $("bMap").addEventListener("click", function () { openMap("city"); });
  mini.addEventListener("click", function () { openMap("city"); });
  $("mapClose").addEventListener("click", closeMap);
  window.addEventListener("resize", function () { if (!$("mapov").hidden) { fitBig(); drawBig(); } });
  (function () {
    var pts = {}, moved = 0, pinch0 = 0, s0 = 0;
    function zoomBy(f) { if (mapMode === "world") WV.s = clamp(WV.s * f, 1.2, 40); else MV.s = clamp(MV.s * f, 0.6, 9); }
    big.addEventListener("pointerdown", function (e) { big.setPointerCapture(e.pointerId); pts[e.pointerId] = { x: e.clientX, y: e.clientY }; moved = 0; var k = Object.keys(pts); if (k.length === 2) { pinch0 = Math.hypot(pts[k[0]].x - pts[k[1]].x, pts[k[0]].y - pts[k[1]].y); s0 = mapMode === "world" ? WV.s : MV.s; } });
    big.addEventListener("pointermove", function (e) {
      var p = pts[e.pointerId]; if (!p) return;
      var k = Object.keys(pts);
      if (k.length === 1) {
        if (mapMode === "world") { WV.lon -= (e.clientX - p.x) / WV.s; WV.lat += (e.clientY - p.y) / WV.s; }
        else { MV.x -= (e.clientX - p.x) / MV.s; MV.z -= (e.clientY - p.y) / MV.s; }
        moved += Math.abs(e.clientX - p.x) + Math.abs(e.clientY - p.y);
      }
      p.x = e.clientX; p.y = e.clientY;
      if (k.length === 2) { var nd = Math.hypot(pts[k[0]].x - pts[k[1]].x, pts[k[0]].y - pts[k[1]].y), ns = s0 * nd / Math.max(1, pinch0); if (mapMode === "world") WV.s = clamp(ns, 1.2, 40); else MV.s = clamp(ns, 0.6, 9); moved = 99; }
      MV.x = clamp(MV.x, CITY_OX - cityHalf, MX2); MV.z = clamp(MV.z, MZ1, MZ2); WV.lon = clamp(WV.lon, -180, 180); WV.lat = clamp(WV.lat, -70, 80); drawBig();
    });
    function up(e) {
      if (!pts[e.pointerId]) return;
      var single = Object.keys(pts).length === 1; delete pts[e.pointerId];
      if (!single || moved > 8) return;
      var r = big.getBoundingClientRect();
      if (mapMode === "world") {
        var lon = WV.lon + (e.clientX - r.left - r.width / 2) / WV.s, lat = WV.lat - (e.clientY - r.top - r.height / 2) / WV.s, bestA = null, bdA = 16 / WV.s;
        AP.forEach(function (a) { var dd = Math.hypot(a.lon - lon, a.lat - lat); if (dd < bdA) { bdA = dd; bestA = a; } });
        wsel = bestA; worldCard(bestA); buildLegend(); drawBig(); return;
      }
      var w = b2w(e.clientX - r.left, e.clientY - r.top), best = null, bd = 18 / MV.s;
      PLACES.forEach(function (p) { var dd = Math.hypot(p.x - w.x, p.z - w.z); if (dd < bd) { bd = dd; best = p; } });
      if (best) { sel = best; setWaypoint(best.x, best.z, best.t); } else { sel = null; setWaypoint(w.x, w.z, "Map pin"); }
      buildLegend(); drawBig();
    }
    big.addEventListener("pointerup", up); big.addEventListener("pointercancel", function (e) { delete pts[e.pointerId]; });
    big.addEventListener("wheel", function (e) { e.preventDefault(); zoomBy(e.deltaY < 0 ? 1.15 : 0.87); drawBig(); }, { passive: false });
  })();
  window.addEventListener("keydown", function (e) { if (e.key === "m" || e.key === "M") { if ($("mapov").hidden) openMap("city"); else closeMap(); } if (e.key === "Escape" && !$("mapov").hidden) closeMap(); });

  function mapTick(tm) {
    if (CITY) { CITY.update(P.mode === "car" ? taxi.x : P.x, P.mode === "car" ? taxi.z : P.z, 650); updateCity(Math.min(0.05, (tm - (mapTick.lt || tm)) / 1000)); mapTick.lt = tm; }
    if (P.mode !== "car") { taxiZone.x = taxi.x; taxiZone.z = taxi.z; }
    var ts = tm / 1000; ANIMS.forEach(function (f) { f(ts); });
    var fl = Math.floor(tm / 160) % 4; polRedM.emissiveIntensity = fl < 2 ? 2.4 : 0.1; polBlueM.emissiveIntensity = fl < 2 ? 0.1 : 2.4;
    if (tm - miniT > 50) { miniT = tm; mini.style.visibility = INSIDE ? "hidden" : ""; drawMini(); if (!$("mapov").hidden) drawBig(); }
    missionTick(); if (!mapTick.dt || tm - mapTick.dt > 1000) { mapTick.dt = tm; dailyTick(); }
    if (G.wp) {
      wpMesh.userData.ring.scale.setScalar(1 + 0.15 * Math.sin(tm / 260));
      var dist = Math.hypot(G.wp.x - P.x, G.wp.z - P.z);
      wpMesh.children[0].visible = dist > 9;
      $("wpChip").hidden = false; $("wpTxt").textContent = G.wp.t + " \u00b7 " + Math.round(dist) + " m";
      if (dist < 3.2 && !G.wp.mission) { clearWaypoint(); toast("You have arrived"); }
    }
  }

  /* ================= Missions ================= */
  var MISSIONS = [
    { id: "welcome", t: "Welcome to the City", from: "City Hall", d: "Get to know " + here().city + ": eat, visit the travel agency, City Hall and the landmark.", reward: 40,
      steps: [{ t: "Eat at Fresh Mart or Sunny Diner", ev: "ate", at: [-64, -13.3] }, { t: "Visit Global Travel", go: [-49, -12.6], r: 2.6 }, { t: "Check in at City Hall", go: [-100, -9.8], r: 3 }, { t: "See the " + CS.lmName, go: [LMX + 26, 0], r: 5 }] },
    { id: "firstShift", t: "First Day at Work", from: "Job Center", d: "Work one full shift. Your own job pays full salary, any other place pays part-time.", reward: 30,
      steps: [{ t: "Work one full shift anywhere", ev: "shift:*", at: null }] },
    { id: "fare", t: "Taxi Fare", from: "City Dispatch", d: "A customer is waiting outside City Hall. Take them to the Tech Hub in time.", reward: 60, limit: 150,
      steps: [{ t: "Get in the taxi", ev: "taxi", at: "taxi" }, { t: "Pick up the customer at City Hall", go: [-100, -3.6], r: 6, car: true, msg: "Customer is in the car" }, { t: "Drop the customer at the Tech Hub", go: [25, 5.4], r: 6, car: true }] },
    { id: "groceries", t: "Grocery Run", from: "Fresh Mart", d: "Pick up two orders at Fresh Mart and deliver them on foot before the timer ends.", reward: 45, limit: 210,
      steps: [{ t: "Pick up the orders at Fresh Mart", go: [-64, -13.3], r: 2.2, msg: "Orders picked up" }, { t: "Deliver to City Hospital", go: [-135, 9.8], r: 2.6, msg: "Delivered" }, { t: "Deliver to Central School", go: [-100, 9.8], r: 2.6 }] },
    { id: "outskirts", t: "Out of Town", from: "City Bus", d: "Take the bus to the outskirts and visit Green Acres Farm.", reward: 25,
      steps: [{ t: "Go to the bus stop on " + CS.street, go: [9, 9.4], r: 2.6 }, { t: "Take the bus to the outskirts", ev: "busOut", at: [9, 9.4] }, { t: "Walk to Green Acres Farm", go: [-16.4, 69], r: 3 }] },
    { id: "gold", t: "Gold Rush", from: "Gold Mine", d: "Collect three gold nuggets around the mine and sell them at City Bank.", reward: 90, limit: 420,
      steps: [{ t: "Go to the Gold Mine", go: [-112, 108.6], r: 3.2 }, { t: "Find gold nugget 1 of 3", go: [-126, 101], r: 2.2, msg: "Gold nugget found" }, { t: "Find gold nugget 2 of 3", go: [-98, 104], r: 2.2, msg: "Gold nugget found" }, { t: "Find gold nugget 3 of 3", go: [-86, 96], r: 2.2, msg: "Gold nugget found" }, { t: "Sell the gold at City Bank", go: [19, -9.8], r: 2.6 }] },
    { id: "speed", t: "Fast Delivery", from: "Oil Field", d: "Spare parts are needed at the oil field. Drive the taxi there before time runs out.", reward: 50, limit: 90,
      steps: [{ t: "Get in the taxi", ev: "taxi", at: "taxi" }, { t: "Drive to the Oil Field gate", go: [ROADX, 70], r: 7, car: true }] },
    { id: "flyer", t: "Frequent Flyer", from: "Global Travel", d: "Book a flight, check in and clear security.", reward: 50,
      steps: [{ t: "Book a flight at Global Travel", ev: "booked", at: [-49, -12.6] }, { t: "Check in at the airport", ev: "checkin", at: [98, -13.8] }, { t: "Clear security", ev: "security", at: [110, 0] }] },
    { id: "hospital", t: "Night Shift", from: "City Hospital", d: "The hospital is short of staff. Work one shift there.", reward: 35, steps: [{ t: "Work a shift at City Hospital", ev: "shift:hospital", at: [-135, 9.8] }] },
    { id: "oilShift", t: "Black Gold", from: "Oil Field", d: "Help keep the pumps running for one shift.", reward: 35, steps: [{ t: "Work a shift at the Oil Field", ev: "shift:oil", at: [6.4, 70] }] },
    { id: "factoryShift", t: "Assembly Line", from: "Factory", d: "Work one shift on the factory line.", reward: 35, steps: [{ t: "Work a shift at the Factory", ev: "shift:factory", at: [30, 110.4] }] },
    { id: "siteShift", t: "Build It", from: "Construction Site", d: "Help the crew for one shift.", reward: 35, steps: [{ t: "Work a shift at the Construction Site", ev: "shift:site", at: [52, 9.9] }] }
  ];
  /* more missions in the real city: steps with pid follow the real place doors */
  [
    { id: "morning", t: "Morning Routine", from: "Your phone", d: "Leave home, grab a coffee and get to the office on time.", reward: 35, limit: 420, steps: [{ t: "Step out of your home", pid: "home", r: 3 }, { t: "Get a coffee at the cafe", pid: "cafe", r: 3 }, { t: "Walk to the office", pid: "work", r: 3 }] },
    { id: "bankErrand", t: "Bank Errand", from: "City Bank", d: "Your new account card is ready. Pick it up inside the bank.", reward: 25, steps: [{ t: "Go to the bank", pid: "bank", r: 3 }, { t: "Go inside the bank", ev: "enter:bank", pid: "bank" }] },
    { id: "checkup", t: "Health Check", from: "City Hospital", d: "Visit the hospital for your yearly check-up.", reward: 25, steps: [{ t: "Go to the hospital", pid: "hospital", r: 3 }, { t: "Go inside", ev: "enter:hospital", pid: "hospital" }] },
    { id: "explorer", t: "City Explorer", from: "Tourism Office", d: "See the most famous places in the city.", reward: 60, steps: [{ t: "Visit the landmark", pid: "landmark", r: 12 }, { t: "Visit City Hall", pid: "cityhall", r: 4 }, { t: "Visit the hotel", pid: "hotel", r: 4 }, { t: "Visit the school", pid: "school", r: 4 }] },
    { id: "courier", t: "Package Courier", from: "Supermarket", d: "Deliver two parcels across the city before time runs out.", reward: 70, limit: 300, steps: [{ t: "Pick up the parcels at the supermarket", pid: "grocery", r: 3, msg: "Parcels picked up" }, { t: "Deliver to the hotel", pid: "hotel", r: 3, msg: "Delivered" }, { t: "Deliver to the hospital", pid: "hospital", r: 3 }] },
    { id: "taxiShift", t: "Taxi Shift", from: "City Dispatch", d: "Two customers need a ride. Drive them in the taxi.", reward: 80, limit: 360, steps: [{ t: "Get in the taxi (call one from your phone)", ev: "taxi", at: "taxi" }, { t: "Drive to the hotel", pid: "hotel", r: 14, car: true, msg: "Customer dropped off" }, { t: "Drive to City Hall", pid: "cityhall", r: 14, car: true }] },
    { id: "dinner", t: "Dinner Out", from: "Restaurant", d: "Book a table and enjoy a full meal.", reward: 30, steps: [{ t: "Go to the restaurant", pid: "diner", r: 3 }, { t: "Go inside", ev: "enter:diner", pid: "diner" }, { t: "Sit down and eat", ev: "ate", pid: "diner" }] },
    { id: "homeSweet", t: "Home Sweet Home", from: "Landlord", d: "Check your new home and relax on the sofa.", reward: 20, steps: [{ t: "Go home", pid: "home", r: 3 }, { t: "Go inside", ev: "enter:home", pid: "home" }, { t: "Sit on the sofa", ev: "homeSofa", pid: "home" }] },
    { id: "airportRun", t: "Airport Run", from: "EarthPass Air", d: "Drive to the airport terminal by taxi.", reward: 50, steps: [{ t: "Get in the taxi", ev: "taxi", at: "taxi" }, { t: "Drive to the airport", go: [AX1 - 8, 4], r: 14, car: true }] },
    { id: "travelDocs", t: "Travel Documents", from: "Global Travel", d: "Book a flight, check in and get your exit stamp.", reward: 60, steps: [{ t: "Book a flight at Global Travel", ev: "booked", pid: "agency" }, { t: "Check in at the airport", ev: "checkin", at: [98, -13.8] }, { t: "Clear security", ev: "security", at: [110, 0] }, { t: "Get your exit stamp", ev: "immigrationDone", at: [125.8, 0] }] }
  ].forEach(function (m) { MISSIONS.push(m); });
  var MIS = {}; MISSIONS.forEach(function (m) { MIS[m.id] = m; });
  function pidPos(pid) { var pl = pid === "home" ? HOME : cityPlaces[pid]; return pl ? [pl.x, pl.z] : null; }

  /* daily tasks: new every day, paid on completion */
  var DAILY_KIND = [
    function (r) { var pid = ["cafe", "bank", "hotel", "school", "hospital", "cityhall", "landmark", "grocery", "diner"][Math.floor(r() * 9)]; return { k: "visit", pid: pid, t: "Visit " + ((cityPlaces[pid] && cityPlaces[pid].name) || pid), need: 1, pay: 10 }; },
    function () { return { k: "shift", t: "Work 2 shifts", need: 2, pay: 25 }; },
    function () { return { k: "eat", t: "Eat a meal", need: 1, pay: 8 }; },
    function () { return { k: "walk", t: "Walk 1 km", need: 1000, pay: 12 }; },
    function () { return { k: "drive", t: "Drive 2 km", need: 2000, pay: 15 }; },
    function () { return { k: "mission", t: "Finish any mission", need: 1, pay: 20 }; },
    function () { return { k: "inside", t: "Go inside 3 buildings", need: 3, pay: 12 }; }
  ];
  function dailyKey() { return fmtD(now(), here().tz); }
  function ensureDaily() {
    if (G.daily && G.daily.day === dailyKey()) return;
    var r = rng(hash(dailyKey() + G.passport.no)), list = [], used = {};
    while (list.length < 5) { var i = Math.floor(r() * DAILY_KIND.length); if (used[i] && i !== 0) continue; used[i] = 1; var t = DAILY_KIND[i](r); t.have = 0; t.done = false; list.push(t); }
    G.daily = { day: dailyKey(), tasks: list }; save();
  }
  function dailyBump(kind, n, pid) {
    if (!G.daily) return;
    G.daily.tasks.forEach(function (t) {
      if (t.done || t.k !== kind || (t.pid && pid && t.pid !== pid)) return;
      t.have = Math.min(t.need, t.have + (n || 1));
      if (t.have >= t.need) { t.done = true; earn(t.pay, "Daily task \u00b7 " + t.t); toast("Daily task done \u00b7 +" + t.pay + " TOKEN"); }
    });
    save();
  }
  var dailyLast = null;
  function dailyTick() {
    ensureDaily();
    var pos = P.mode === "car" ? [taxi.x, taxi.z] : [P.x, P.z];
    if (dailyLast && !INSIDE) { var d = Math.hypot(pos[0] - dailyLast[0], pos[1] - dailyLast[1]); if (d < 30 && d > 0.05) dailyBump(P.mode === "car" ? "drive" : "walk", d); }
    dailyLast = pos;
    G.daily.tasks.forEach(function (t) { if (!t.done && t.k === "visit") { var pp = pidPos(t.pid); if (pp && Math.hypot(P.x - pp[0], P.z - pp[1]) < (t.pid === "landmark" ? 14 : 5)) dailyBump("visit", 1, t.pid); } });
  }
  var NUGGETS = [[-126, 101], [-98, 104], [-86, 96]].map(function (p) { var n = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35, 0), new THREE.MeshStandardMaterial({ color: 0xe8b84a, metalness: 1, roughness: 0.25, emissive: 0x5a4000 })); n.position.set(p[0], 0.5, p[1]); n.visible = false; n.castShadow = true; scene.add(n); return n; });
  function msg(from, text) { G.msgs.unshift({ f: from, x: text, t: now(), n: true }); if (G.msgs.length > 40) G.msgs.length = 40; save(); }
  if (!G.msgs.length) msg("EarthPass", "Welcome, " + G.passport.first + ". You are a " + G.passport.job[0] + ". Open Missions on your phone to start, or work a shift to earn TOKEN.");
  function stepTarget(s) { if (s.go) return s.go; if (s.pid && !s.ev) return pidPos(s.pid); if (s.at === "taxi") return [taxi.x, taxi.z]; if (s.pid) return pidPos(s.pid); return s.at; }
  function aimStep() {
    var m = G.mis && MIS[G.mis.id]; if (!m) return;
    var s = m.steps[G.mis.step], p = stepTarget(s);
    if (p) { G.wp = { x: p[0], z: p[1], t: s.t, mission: true }; wpMesh.position.set(p[0], 0, p[1]); wpMesh.visible = true; } else { G.wp = null; wpMesh.visible = false; $("wpChip").hidden = true; }
    save();
  }
  function startMission(id) {
    var m = MIS[id]; if (!m) return;
    G.mis = { id: id, step: 0, t0: Date.now() }; aimStep(); toast("Mission started \u00b7 " + m.t); closePhone();
  }
  function quitMission(text) { G.mis = null; if (G.wp && G.wp.mission) { G.wp = null; wpMesh.visible = false; $("wpChip").hidden = true; } save(); if (text) toast(text); }
  function advance() {
    var m = MIS[G.mis.id], s = m.steps[G.mis.step];
    if (s.msg) toast(s.msg);
    G.mis.step++;
    if (G.mis.step >= m.steps.length) {
      var rep = G.done[m.id], pay = rep ? Math.round(m.reward / 2) : m.reward;
      G.done[m.id] = (G.done[m.id] || 0) + 1; earn(pay, "Mission \u00b7 " + m.t); dailyBump("mission");
      msg(m.from, "Thank you! \"" + m.t + "\" is complete. +" + pay + " TOKEN sent to your account.");
      quitMission("Mission complete \u00b7 +" + pay + " TOKEN");
      return;
    }
    aimStep();
  }
  function missionEvent(name) {
    if (name === "ate") dailyBump("eat"); else if (name.indexOf("enter:") === 0) dailyBump("inside"); else if (name.indexOf("shift:") === 0) dailyBump("shift");
    if (!G.mis) return; var m = MIS[G.mis.id]; if (!m) return; var s = m.steps[G.mis.step]; if (!s || !s.ev) return;
    if (s.ev === name || (s.ev.slice(-1) === "*" && name.indexOf(s.ev.slice(0, -1)) === 0)) advance();
  }
  function missionTick() {
    var ch = $("misChip");
    if (!G.mis || !MIS[G.mis.id]) { if (!ch.hidden) { ch.hidden = true; NUGGETS.forEach(function (n) { n.visible = false; }); } return; }
    var m = MIS[G.mis.id], s = m.steps[G.mis.step];
    NUGGETS.forEach(function (n, i) { n.visible = m.id === "gold" && G.mis.step <= i + 1; n.rotation.y += 0.03; n.position.y = 0.5 + Math.sin(performance.now() / 300 + i) * 0.12; });
    if (s.ev === "taxi" && P.mode === "car") { advance(); return; }
    var sg = s.go || (s.pid && !s.ev ? pidPos(s.pid) : null);
    if (sg && (!s.car || P.mode === "car") && Math.hypot(P.x - sg[0], P.z - sg[1]) < s.r) { advance(); return; }
    if (s.pid && G.wp && G.wp.mission) { var tp = stepTarget(s); if (tp && (Math.abs(G.wp.x - tp[0]) > 0.5 || Math.abs(G.wp.z - tp[1]) > 0.5)) { G.wp.x = tp[0]; G.wp.z = tp[1]; wpMesh.position.set(tp[0], 0, tp[1]); } }
    if (s.at === "taxi" && G.wp && P.mode !== "car") { G.wp.x = taxi.x; G.wp.z = taxi.z; wpMesh.position.set(taxi.x, 0, taxi.z); }
    var left = m.limit ? m.limit - (Date.now() - G.mis.t0) / 1000 : null;
    if (left !== null && left <= 0) { msg(m.from, "Too late this time. You can try \"" + m.t + "\" again from Missions."); quitMission("Mission failed \u00b7 time is up"); return; }
    ch.hidden = false; $("misT").textContent = m.t; $("misS").textContent = (G.mis.step + 1) + "/" + m.steps.length + " \u00b7 " + s.t + (left !== null ? " \u00b7 " + Math.floor(left / 60) + ":" + String(Math.floor(left % 60)).padStart(2, "0") : "") + (s.car && P.mode !== "car" ? " \u00b7 in the taxi" : "");
  }

  /* ================= Phone ================= */
  var phoneOpen = false, phoneProp = null;
  var APPS = [
    ["Missions", "MI", "#ccff00", "missions"], ["Map", "MP", "#7bd88f", "map"], ["World", "WD", "#5ab0ff", "world"], ["Jobs", "JB", "#f2c230", "jobs"],
    ["Bank", "BK", "#6fa8ff", "bank"], ["Messages", "MS", "#ff8a5c", "msgs"], ["Taxi", "TX", "#f2c230", "taxi"], ["Flights", "FL", "#c9a7ff", "flights"],
    ["Passport", "PP", "#e9ece6", "passport"], ["Clock", "CL", "#9fb3ff", "clock"], ["Camera", "CA", "#ff7a59", "camera"], ["Settings", "ST", "#9aa392", "settings"]
  ];
  function head(title) { return "<div class='ph-h'><button type='button' data-go='home'>Back</button><b>" + title + "</b></div>"; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function phoneApp(id) {
    var b = $("phBody"), h = "";
    if (id === "home") {
      var unread = G.msgs.filter(function (m) { return m.n; }).length;
      h = "<div class='ph-home'>" + APPS.map(function (a) { return "<button class='app' type='button' data-go='" + a[3] + "'><span style='background:" + a[2] + "'>" + a[1] + "</span>" + a[0] + (a[3] === "msgs" && unread ? " (" + unread + ")" : "") + "</button>"; }).join("") + "</div>";
      if (G.mis && MIS[G.mis.id]) h += "<div class='ph-card' style='margin-top:18px'><span class='ph-tag'>ACTIVE MISSION</span><h4>" + MIS[G.mis.id].t + "</h4><p>" + MIS[G.mis.id].steps[G.mis.step].t + "</p></div>";
    } else if (id === "missions") {
      ensureDaily();
      h = head("Missions") + "<p class='ph-tag' style='margin:4px 2px 8px'>DAILY TASKS \u00b7 NEW EVERY DAY</p>" + G.daily.tasks.map(function (t) { var pct = Math.min(100, Math.round(t.have / t.need * 100)); return "<div class='ph-card'><div class='row2'><h4>" + esc(t.t) + "</h4><span class='ph-tag'>" + (t.done ? "DONE \u2713" : "+" + t.pay + " TOKEN") + "</span></div><div style='height:6px;border-radius:3px;background:rgba(255,255,255,.1);overflow:hidden'><i style='display:block;height:100%;width:" + pct + "%;background:#ccff00'></i></div></div>"; }).join("") + "<p class='ph-tag' style='margin:14px 2px 8px'>MISSIONS</p>" + MISSIONS.map(function (m) {
        var act = G.mis && G.mis.id === m.id, n = G.done[m.id] || 0;
        return "<div class='ph-card'><div class='row2'><span class='ph-tag'>FROM " + m.from.toUpperCase() + "</span><span class='ph-tag'>" + (n ? "DONE \u00d7" + n : m.reward + " TOKEN") + "</span></div><h4>" + m.t + "</h4><p>" + m.d + (m.limit ? " Time limit " + Math.round(m.limit / 60 * 10) / 10 + " min." : "") + "</p>" +
          "<div class='row2'><span class='ph-tag'>" + m.steps.length + " steps" + (n ? " \u00b7 replay pays " + Math.round(m.reward / 2) : "") + "</span>" + (act ? "<button class='btn ghost' type='button' data-quit='1'>Quit</button>" : "<button class='btn' type='button' data-mis='" + m.id + "'>" + (n ? "Replay" : "Start") + "</button>") + "</div></div>";
      }).join("");
    } else if (id === "jobs") {
      var own = workFor(G.passport.job[0]);
      h = head("Jobs") + "<div class='ph-card'><span class='ph-tag'>YOUR PROFESSION \u00b7 " + G.passport.job[1].toUpperCase() + "</span><h4>" + G.passport.job[0] + "</h4><p>" + (G.passport.job[0] === "Taxi Driver" ? "Drive the taxi from the Taxi Rank. You earn per kilometre." : own ? "Work at " + own.t + ". " + G.passport.job[4] + " TOKEN per shift. You are paid only while you work." : "") + "</p>" +
        (own || G.passport.job[0] === "Taxi Driver" ? "<div class='row2'><span></span><button class='btn' type='button' data-wp='" + (own ? own.x + "," + own.z + "," + own.t : "-63.4,18,Taxi Rank") + "'>Set waypoint</button></div>" : "") + "</div>" +
        "<p class='ph-tag' style='margin:14px 2px 8px'>WORKPLACES \u00b7 PART-TIME PAYS " + GIG + " TOKEN</p>" +
        WORK.map(function (w) { var mine = w.jobs.indexOf(G.passport.job[0]) >= 0; return "<div class='ph-card'><div class='row2'><h4>" + w.t + "</h4>" + (mine ? "<span class='ph-tag'>YOUR JOB</span>" : "") + "</div><p>" + w.jobs.join(", ") + " \u00b7 part-time " + w.gig + "</p><div class='row2'><span></span><button class='btn ghost' type='button' data-wp='" + w.x + "," + w.z + "," + w.t + "'>Go there</button></div></div>"; }).join("") +
        "<p class='ph-tag' style='margin:14px 2px 8px'>GOVERNMENT \u00b7 RUN BY THE TEAM</p>" + GOV.map(function (j) { return "<div class='ph-card'><h4>" + j[0] + "</h4><p>" + j[1] + " \u00b7 team only</p></div>"; }).join("");
    } else if (id === "bank") {
      h = head("City Bank") + "<div class='ph-card'><span class='ph-tag'>BALANCE</span><span class='ph-big'>" + Math.round(G.balance).toLocaleString("en-US") + "</span><p>TOKEN \u00b7 account " + G.passport.no + "</p></div>" +
        (G.tx.length ? G.tx.map(function (t) { return "<div class='ph-card'><div class='row2'><h4>" + esc(t.l) + "</h4><span class='ph-amt " + (t.a < 0 ? "neg" : "pos") + "'>" + (t.a > 0 ? "+" : "") + t.a + "</span></div><p>" + (AIR[t.c] ? AIR[t.c].city + " \u00b7 " : "") + fmtD(t.t, (AIR[t.c] || here()).tz) + " " + fmtT(t.t, (AIR[t.c] || here()).tz) + "</p></div>"; }).join("") : "<p class='ph-tag'>No transactions yet</p>");
    } else if (id === "msgs") {
      h = head("Messages") + G.msgs.map(function (m) { return "<div class='ph-card'><div class='row2'><h4>" + esc(m.f) + "</h4><span class='ph-tag'>" + fmtT(m.t, here().tz) + "</span></div><p>" + esc(m.x) + "</p></div>"; }).join("");
      G.msgs.forEach(function (m) { m.n = false; }); save();
    } else if (id === "taxi") {
      h = head("Taxi") + "<div class='ph-card'><h4>Call a taxi</h4><p>The yellow taxi comes to the nearest road next to you. You drive it yourself." + (G.passport.job[0] === "Taxi Driver" ? " As a taxi driver you earn per kilometre." : "") + "</p><div class='row2'><span class='ph-tag'>FEE 5 TOKEN</span><button class='btn' type='button' data-taxi='1'" + (P.mode === "car" || G.balance < 5 ? " disabled" : "") + ">Call now</button></div></div>";
    } else if (id === "flights") {
      var tr = G.trip;
      h = head("Flights") + (tr ? "<div class='ph-card'><span class='ph-tag'>YOUR TICKET \u00b7 " + tr.no + "</span><h4>" + AIR[tr.from].city + " to " + AIR[tr.to].city + "</h4><p>Departs " + fmtD(tr.dep, AIR[tr.from].tz) + " " + fmtT(tr.dep, AIR[tr.from].tz) + " local \u00b7 seat " + tr.seat + " \u00b7 flight " + dur(tr.dur) + "</p><div class='row2'><span></span><button class='btn' type='button' data-wp='" + (G.flags.checkin ? "156,12,Gate B12" : "98,-13.8,Check-in") + "'>Guide me</button></div></div>" :
        "<div class='ph-card'><h4>No ticket</h4><p>Book flights and visas at Global Travel on " + CS.street + ".</p><div class='row2'><span></span><button class='btn' type='button' data-wp='-49,-12.6,Global Travel'>Go to Global Travel</button></div></div>") +
        "<div class='ph-card'><h4>World map</h4><p>See every airport, local times and flight times.</p><div class='row2'><span></span><button class='btn ghost' type='button' data-go='world'>Open</button></div></div>";
    } else if (id === "clock") {
      h = head("World Clock") + ["JFK", "LAX", "LHR", "CDG", "DXB", "DAC", "SIN", "NRT", "SYD"].map(function (c) { var a = AIR[c]; return "<div class='ph-card'><div class='row2'><h4>" + a.city + "</h4><span class='ph-big' style='font-size:22px'>" + fmtT(now(), a.tz) + "</span></div><p>" + fmtD(now(), a.tz) + " \u00b7 " + a.country + "</p></div>"; }).join("");
    }
    b.innerHTML = h; b.scrollTop = 0;
  }
  function openPhone() { $("phone").hidden = false; phoneOpen = true; phoneApp("home"); if (phoneProp) phoneProp.visible = true; }
  function closePhone() { $("phone").hidden = true; phoneOpen = false; if (phoneProp) phoneProp.visible = false; }
  function callTaxi() {
    if (P.mode === "car") return;
    var zx, zz, yaw;
    if (CITY && CITY.inBounds(P.x, P.z)) {
      var rd = CITY.nearestRoad(P.x, P.z, 250, 2); if (!rd) { toast("No road nearby"); return; }
      var off = rd.road.o ? 0 : Math.max(1.4, rd.road.w / 4);
      spend(5, "Taxi call"); taxi.x = rd.x + (-rd.dz) * off; taxi.z = rd.z + rd.dx * off; taxi.yaw = Math.atan2(-rd.dz, rd.dx); taxi.v = 0; closePhone();
      setWaypoint(taxi.x, taxi.z, "Your taxi"); toast("Your taxi has arrived"); return;
    }
    if (P.z > 30 && P.x > -160 && P.x < 90) { if (Math.abs(P.z - 95) < 10) { zx = clamp(P.x, -150, 80); zz = 97; yaw = 0; } else { zx = ROADX + 2.5; zz = clamp(P.z, 20, 160); yaw = Math.PI / 2; } }
    else if (Math.abs(P.z) < 40 && P.x > CITY_X1 - 40 && P.x < CITY_X2) {
      var sd = P.z >= 0 ? 1 : -1; zz = sd * 5.9; yaw = sd > 0 ? 0 : Math.PI; zx = null;
      for (var off = 0; off < 60 && zx === null; off += 1.5) [P.x + off, P.x - off].forEach(function (x) { if (zx !== null) return; var ok = x > CITY_X1 - 30 && x < CITY_X2 - 4; COL.forEach(function (c) { if (ok && c.on && c.tag === "car" && x + 3 > c.x1 && x - 3 < c.x2 && zz + 1.2 > c.z1 && zz - 1.2 < c.z2) ok = false; }); if (ok) zx = x; });
      if (zx === null) { zx = P.x; zz = sd * 3.6; }
    } else { toast("No taxi can reach you here"); return; }
    spend(5, "Taxi call"); taxi.x = zx; taxi.z = zz; taxi.yaw = yaw; taxi.v = 0; closePhone();
    setWaypoint(zx, zz, "Your taxi"); toast("Your taxi has arrived");
  }
  $("phBody").addEventListener("click", function (e) {
    var t = e.target.closest("button"); if (!t) return;
    if (t.dataset.go) {
      var g2 = t.dataset.go;
      if (g2 === "map") { closePhone(); openMap("city"); } else if (g2 === "world") { closePhone(); openMap("world"); }
      else if (g2 === "passport") { closePhone(); openPassport(); } else if (g2 === "settings") { closePhone(); $("bSet").click(); }
      else if (g2 === "camera") { closePhone(); document.body.classList.add("photo"); toast("Photo mode \u00b7 tap the screen to exit"); setTimeout(function () { $("toast").hidden = true; }, 1600); }
      else phoneApp(g2);
    }
    if (t.dataset.mis) startMission(t.dataset.mis);
    if (t.dataset.quit) { quitMission("Mission stopped"); phoneApp("missions"); }
    if (t.dataset.wp) { var p = t.dataset.wp.split(","); closePhone(); setWaypoint(+p[0], +p[1], p.slice(2).join(",")); }
    if (t.dataset.taxi) callTaxi();
  });
  $("phHome").addEventListener("click", function () { if ($("phBody").querySelector(".ph-home")) closePhone(); else phoneApp("home"); });
  $("bPhone").addEventListener("click", function () { if (phoneOpen) closePhone(); else openPhone(); });
  window.addEventListener("keydown", function (e) { if ((e.key === "p" || e.key === "P") && $("modal").hidden) { if (phoneOpen) closePhone(); else openPhone(); } });
  document.addEventListener("pointerdown", function () { if (document.body.classList.contains("photo")) setTimeout(function () { document.body.classList.remove("photo"); }, 50); }, true);
  if (G.mis && MIS[G.mis.id]) aimStep(); else G.mis = null;

  /* ================= Real-map city (OpenStreetMap) ================= */
  var cityReady = false, SERVER = window.PW_SERVER || null, CITY_OX = -1750, CITY_OZ = 0, cityHalf = 1500, CMS = 0.5, cityCanvas = null, cityCtx = null, cityOV = null;
  var CITY_NAME = SERVER ? here().city : "Utrecht", CITY_PREVIEW = !SERVER;
  var cityBase = SERVER ? SERVER + "/city/" + G.city : "tiles/UTR";
  plane(3300, 3300, M.grass, CITY_OX, -0.025, CITY_OZ);
  plane(80, 14, M.asphalt, -226, 0.004, 0);
  function cmX(x) { return (x + cityHalf) * CMS; }
  function drawTileOnMap(key, d) {
    if (!cityCtx) return; var c = cityCtx;
    c.fillStyle = "#3a403a"; c.strokeStyle = "rgba(255,255,255,0.10)"; c.lineWidth = 0.6;
    d.b.forEach(function (b) { var p = b.p; c.beginPath(); c.moveTo(cmX(p[0]), cmX(p[1])); for (var i = 2; i < p.length; i += 2) c.lineTo(cmX(p[i]), cmX(p[i + 1])); c.closePath(); c.fill(); c.stroke(); });
    drawRoadsOn(c, d.r);
  }
  function drawRoadsOn(c, roads) {
    c.lineCap = "round"; c.lineJoin = "round";
    [6, 5, 4, 3, 2, 1, 0].forEach(function (cl) {
      roads.forEach(function (r) {
        if (r.c !== cl) return; var p = r.p;
        c.strokeStyle = cl >= 5 ? "#6b6a5e" : cl <= 1 ? "#d9c37a" : "#8c9196"; c.lineWidth = Math.max(cl >= 5 ? 0.8 : 1.4, (r.w || (cl <= 1 ? 11 : cl <= 3 ? 7 : 4)) * CMS);
        c.beginPath(); c.moveTo(cmX(p[0]), cmX(p[1])); for (var i = 2; i < p.length; i += 2) c.lineTo(cmX(p[i]), cmX(p[i + 1])); c.stroke();
      });
    });
  }
  function drawOverview(ov) {
    cityCanvas = document.createElement("canvas"); cityCanvas.width = cityCanvas.height = Math.round(cityHalf * 2 * CMS); cityCtx = cityCanvas.getContext("2d");
    var c = cityCtx; c.fillStyle = "#1b2a1c"; c.fillRect(0, 0, cityCanvas.width, cityCanvas.height);
    var poly = function (p, col) { c.fillStyle = col; c.beginPath(); c.moveTo(cmX(p[0]), cmX(p[1])); for (var i = 2; i < p.length; i += 2) c.lineTo(cmX(p[i]), cmX(p[i + 1])); c.closePath(); c.fill(); };
    ov.g.forEach(function (g) { poly(g.p, "#2c5a30"); });
    ov.w.forEach(function (w) { if (w.line) { c.strokeStyle = "#2f6f93"; c.lineWidth = w.line * CMS; c.beginPath(); c.moveTo(cmX(w.p[0]), cmX(w.p[1])); for (var i = 2; i < w.p.length; i += 2) c.lineTo(cmX(w.p[i]), cmX(w.p[i + 1])); c.stroke(); } else poly(w.p, "#2f6f93"); });
    var rails = ov.r.filter(function (r) { return r.c === 9; }); c.strokeStyle = "#9a9a9a"; c.setLineDash([3, 3]); c.lineWidth = 1.4;
    rails.forEach(function (r) { var p = r.p; c.beginPath(); c.moveTo(cmX(p[0]), cmX(p[1])); for (var i = 2; i < p.length; i += 2) c.lineTo(cmX(p[i]), cmX(p[i + 1])); c.stroke(); }); c.setLineDash([]);
    drawRoadsOn(c, ov.r.filter(function (r) { return r.c !== 9; }));
  }

  /* real places become the game's workplaces and services */
  var CPLACES = [
    { id: "grocery", zone: "grocery", t: ["shop:supermarket", "shop:convenience", "shop:greengrocer"], fn: "Supermarket" },
    { id: "agency", zone: "agency", t: ["shop:travel_agency", "office"], fn: "Travel agency", rename: "Global Travel" },
    { id: "cityhall", zone: "cityhall", t: ["townhall", "courthouse", "library"], fn: "City Hall · land office" },
    { id: "work", zone: "job:office", t: ["office"], fn: "Offices" },
    { id: "bank", zone: "job:bank", t: ["bank"], fn: "Bank" },
    { id: "hotel", zone: "job:hotel", t: ["hotel"], fn: "Hotel" },
    { id: "diner", zone: "job:diner", t: ["restaurant", "fast_food"], fn: "Restaurant", eat: true },
    { id: "hospital", zone: "job:hospital", t: ["hospital", "clinic", "doctors"], fn: "Hospital" },
    { id: "school", zone: "job:school", t: ["school", "college", "university"], fn: "School" },
    { id: "cafe", zone: "job:cafe", t: ["cafe"], fn: "Cafe" },
    { id: "tech", zone: "job:tech", t: ["office", "college", "university"], fn: "Tech offices" },
    { id: "police", zone: "police", t: ["police"], fn: "Police" },
    { id: "landmark", zone: null, t: ["attraction", "museum", "place_of_worship", "artwork", "theatre"], fn: "Landmark" }
  ];
  var cityPlaces = {}, doorMarks = [];
  function labelSprite(text, sub) {
    var c = document.createElement("canvas"); c.width = 512; c.height = 128; var g = c.getContext("2d");
    g.fillStyle = "rgba(8,10,8,0.82)"; var r = 22; g.beginPath(); g.moveTo(r, 0); g.arcTo(512, 0, 512, 128, r); g.arcTo(512, 128, 0, 128, r); g.arcTo(0, 128, 0, 0, r); g.arcTo(0, 0, 512, 0, r); g.fill();
    g.fillStyle = "#ccff00"; g.fillRect(0, 0, 10, 128);
    g.fillStyle = "#ffffff"; g.font = "800 44px Unbounded, Arial, sans-serif"; g.textBaseline = "middle"; var t = text.length > 18 ? text.slice(0, 17) + "…" : text; g.fillText(t, 30, 50);
    g.fillStyle = "#ccff00"; g.font = "600 26px 'JetBrains Mono', monospace"; g.fillText(sub.toUpperCase(), 30, 98);
    var tx = new THREE.CanvasTexture(c); tx.encoding = THREE.sRGBEncoding;
    var s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, depthWrite: false, transparent: true })); s.scale.set(4.6, 1.15, 1); return s;
  }
  function assignPlaces(ov) {
    var used = [], old = {};
    PLACES.forEach(function (p) { old[p.id] = [p.x, p.z]; });
    CPLACES.forEach(function (cp) {
      var best = null, bd = 1e9;
      ov.poi.forEach(function (p) {
        if (cp.t.indexOf(p.t) < 0) return;
        var d = Math.hypot(p.x, p.z) + cp.t.indexOf(p.t) * 120; if (d > bd) return;
        if (used.some(function (u) { return Math.hypot(u.x - p.x, u.z - p.z) < 30; })) return;
        bd = d; best = p;
      });
      if (!best) { var a = Math.random() * 6.28, rr = 120 + Math.random() * 200; best = { x: Math.cos(a) * rr, z: Math.sin(a) * rr, t: "office" }; }
      used.push(best);
      var wx = best.x + CITY_OX, wz = best.z + CITY_OZ, nm = cp.rename || best.n || cp.fn;
      var pl = cityPlaces[cp.id] = { cp: cp, x: wx, z: wz, name: nm, fn: cp.fn, resolved: false, poi: best };
      var pp = PLACES.filter(function (q) { return q.id === cp.id; })[0];
      if (pp) { pp.x = wx; pp.z = wz; pp.t = nm; pp.d = cp.fn; }
      if (cp.zone) ZONES.forEach(function (z) { if (z.id === cp.zone && z.w) { z.w.x = wx; z.w.z = wz; z.w.t = nm; } });
      if (cp.id !== "landmark") ZONES.push({ id: "door:" + cp.id, x: wx, z: wz, r: 2.2 });
      var ls = labelSprite(nm, cp.fn); ls.position.set(wx, 4.2, wz); scene.add(ls); pl.label = ls;
      var ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.15, 32), new THREE.MeshBasicMaterial({ color: 0xccff00, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(wx, 0.12, wz); ring.visible = !!cp.zone; scene.add(ring); pl.ring = ring; doorMarks.push(pl);
    });
    /* missions that pointed at old places now point at the real ones */
    MISSIONS.forEach(function (m) { m.steps.forEach(function (s) { ["go", "at"].forEach(function (k) { var v = s[k]; if (!v || typeof v === "string") return; Object.keys(old).forEach(function (id) { if (cityPlaces[id] && Math.hypot(old[id][0] - v[0], old[id][1] - v[1]) < 4) { s[k] = [cityPlaces[id].x, cityPlaces[id].z]; s[k].pid = id; } }); }); }); });
    var inner = {}; Object.keys(PLACE_INT).forEach(function (k) { PLACE_INT[k].slice(1).forEach(function (z) { inner[z] = 1; }); }); ["grocery", "agency", "cityhall", "diner", "police"].forEach(function (z) { inner[z] = 1; });
    ZONES.forEach(function (z) { if (inner[z.id]) { z.x = 99999; z.z = 99999; } });
  }
  /* put each door on the building edge facing the street */
  function resolveDoors() {
    Object.keys(cityPlaces).concat(["home"]).forEach(function (id) {
      var pl = id === "home" ? HOME : cityPlaces[id]; if (!pl || pl.resolved || !CITY) return;
      if (Math.hypot(pl.x - P.x, pl.z - P.z) > 520) return;
      var b = pl.bld || CITY.buildingAt(pl.x, pl.z), road = CITY.nearestRoad(pl.x, pl.z, 160);
      if (!road && CITY.pending()) return;
      var dx = pl.x, dz = pl.z;
      if (b) {
        var p = b.p, best = 1e9, bx = 0, bz = 0, tx = road ? road.x - CITY_OX : dx - CITY_OX, tz = road ? road.z - CITY_OZ : dz - CITY_OZ;
        for (var e = 0, f = p.length - 2; e < p.length; f = e, e += 2) { var x1 = p[f], z1 = p[f + 1], x2 = p[e], z2 = p[e + 1], ex = x2 - x1, ez = z2 - z1, l2 = ex * ex + ez * ez || 1, t = Math.max(0.15, Math.min(0.85, ((tx - x1) * ex + (tz - z1) * ez) / l2)), qx = x1 + ex * t, qz = z1 + ez * t, d = Math.hypot(tx - qx, tz - qz); if (d < best) { best = d; bx = qx; bz = qz; } }
        var ox = tx - bx, oz = tz - bz, ol = Math.hypot(ox, oz) || 1; dx = bx + ox / ol * 1.3 + CITY_OX; dz = bz + oz / ol * 1.3 + CITY_OZ; pl.face = Math.atan2(-ox, -oz);
        pl.bld = b;
        for (var dd = 2.5; dd <= 9 && !freeAt(dx, dz); dd += 1.5) { dx = bx + ox / ol * dd + CITY_OX; dz = bz + oz / ol * dd + CITY_OZ; }
        if (!freeAt(dx, dz) && !CITY.pending()) { var fs = freeSpot(dx, dz); if (fs) { dx = fs.x; dz = fs.z; } }
      } else if (road && road.d > 3) { dx = road.x + (pl.x - road.x) / road.d * Math.min(road.d, (road.road.w / 2 + 2.5)); dz = road.z + (pl.z - road.z) / road.d * Math.min(road.d, (road.road.w / 2 + 2.5)); }
      pl.x = dx; pl.z = dz; pl.resolved = true;
      if (pl.label) pl.label.position.set(dx, 4.2, dz); if (pl.ring) pl.ring.position.set(dx, 0.12, dz);
      ZONES.forEach(function (z) { if (z.id === "door:" + id) { z.x = dx; z.z = dz; } });
      var hp = PLACES.filter(function (q) { return q.id === id; })[0]; if (hp) { hp.x = dx; hp.z = dz; }
      if (id === "home") return;
      var cp = pl.cp;
      if (cp.zone) ZONES.forEach(function (z) { if (z.id === cp.zone && z.w) { z.w.x = dx; z.w.z = dz; } });
      MISSIONS.forEach(function (m) { m.steps.forEach(function (s) { ["go", "at"].forEach(function (k) { var v = s[k]; if (v && typeof v !== "string" && v.pid === id) { v[0] = dx; v[1] = dz; } }); }); });
    });
  }

  /* each passport holder gets a home; better passports get better homes */
  var HOME = null;
  var HOME_TIER = { Legendary: ["Sky Penthouse", 3], Epic: ["Townhouse", 2], Rare: ["Apartment", 1], Common: ["Studio apartment", 0] };
  function pickHome() {
    if (HOME || !CITY) return;
    var list = CITY.buildingsNear(CITY_OX, CITY_OZ, 420); if (list.length < 20) return;
    var tier = HOME_TIER[G.passport.job[1]] || HOME_TIER.Common, rng2 = rng(G.passport.id * 31 + 7);
    var cand = list.filter(function (b) { return tier[1] === 3 ? b.h > 20 : tier[1] === 2 ? (b.k === 0 || b.k === 6) && b.h < 14 : (b.k === 1 || b.k === 0 || b.k === 6) && b.h > 8; });
    if (!cand.length) cand = list;
    if (tier[1] === 3) cand.sort(function (a, b) { return b.h - a.h; }); else cand.sort(function (a, b) { return Math.hypot((a.x1 + a.x2) / 2, (a.z1 + a.z2) / 2) - Math.hypot((b.x1 + b.x2) / 2, (b.z1 + b.z2) / 2); });
    var b = cand[Math.floor(rng2() * Math.min(cand.length, tier[1] === 3 ? 2 : 25))];
    HOME = { x: (b.x1 + b.x2) / 2 + CITY_OX, z: (b.z1 + b.z2) / 2 + CITY_OZ, bld: b, name: tier[0], tier: tier[1], resolved: false };
    var ls = labelSprite("Your " + tier[0].toLowerCase(), "Home"); ls.position.set(HOME.x, 4.2, HOME.z); scene.add(ls); HOME.label = ls;
    var ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.15, 32), new THREE.MeshBasicMaterial({ color: 0xccff00, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; scene.add(ring); HOME.ring = ring;
    ZONES.push({ id: "door:home", x: HOME.x, z: HOME.z, r: 2.2 });
    PLACES.unshift({ id: "home", t: "Your " + tier[0].toLowerCase(), d: "Home", b: "HM", c: "#ccff00", x: HOME.x, z: HOME.z });
    resolveDoors();
  }

  /* city traffic on the real road graph */
  var CT = [], PEDS = [], ctT = 0;
  var CT_COL = [0x1f2a44, 0xd8dde4, 0x2b2b2e, 0x8a1c1c, 0x3a5a8c, 0x5e5e66, 0x0f3d3a, 0xf4f4f2, 0x7a4a2a, 0x13306b];
  function roadsNear(maxC) { var out = []; Object.keys(CITY.tiles).forEach(function (k) { CITY.tiles[k].roads.forEach(function (r) { if (r.c <= maxC && r.len > 8) out.push(r); }); }); return out; }
  function placeAgent(a) {
    var pt = CITY.pointAt(a.r, a.s), hx = pt.dx * a.dir, hz = pt.dz * a.dir, off = a.lane;
    a.x = pt.x + (-hz) * off; a.z = pt.z + hx * off; a.hx = hx; a.hz = hz;
  }
  function spawnCar() {
    var rs = roadsNear(3); if (!rs.length) return;
    for (var tries = 0; tries < 12; tries++) {
      var r = rs[Math.floor(Math.random() * rs.length)], s = Math.random() * r.len, pt = CITY.pointAt(r, s), d = Math.hypot(pt.x - P.x, pt.z - P.z);
      if (d < 60 || d > 260) continue;
      var kinds = ["sedan", "suv", "hatch", "coupe", "sedan", "pickup", "van", "suv"], k = kinds[Math.floor(Math.random() * kinds.length)], isTaxi = Math.random() < 0.12;
      var m = carMesh(isTaxi ? 0xf2c230 : CT_COL[Math.floor(Math.random() * CT_COL.length)], k, isTaxi); scene.add(m);
      var a = { m: m, r: r, dir: r.o ? 1 : (Math.random() < 0.5 ? 1 : -1), s: s, v: 6, vmax: r.c <= 1 ? 13 : r.c === 2 ? 11 : 8, lane: r.o ? 0 : Math.max(1.4, r.w / 4), x: 0, z: 0, yaw: 0, city: true };
      placeAgent(a); CT.push(a); CARS.push(a); return;
    }
  }
  function dropCar(a) { scene.remove(a.m); CT.splice(CT.indexOf(a), 1); var i = CARS.indexOf(a); if (i >= 0) CARS.splice(i, 1); }
  function stepAgent(a, ds, maxC) {
    a.s += ds * a.dir;
    var guard = 0;
    while ((a.s > a.r.len || a.s < 0) && guard++ < 4) {
      var atNode = a.s > a.r.len ? a.r.b : a.r.a, over = a.s > a.r.len ? a.s - a.r.len : -a.s;
      var opts = CITY.next(a.r, atNode).filter(function (q) { return q.c <= maxC && !(q.o && q.b === atNode); });
      if (!opts.length) { if (a.r.o) return false; a.dir = -a.dir; a.s = a.dir > 0 ? over : a.r.len - over; continue; }
      var nr = opts[Math.floor(Math.random() * opts.length)];
      a.r = nr; a.dir = nr.a === atNode ? 1 : -1; a.s = a.dir > 0 ? over : nr.len - over; a.lane = a.city && !nr.o ? Math.max(1.4, nr.w / 4) : a.lane; if (a.city && nr.o) a.lane = 0;
    }
    return true;
  }
  function updateCity(dt) {
    if (!CITY || !CITY.inBounds(P.x, P.z) && Math.hypot(P.x - CITY_OX, P.z - CITY_OZ) > cityHalf + 400) { while (CT.length) dropCar(CT[0]); return; }
    ctT += dt;
    if (ctT > 0.35) { ctT = 0; if (CT.length < 26) spawnCar(); if (PEDS.length < 18) spawnPed(); resolveDoors(); pickHome(); }
    for (var i = CT.length - 1; i >= 0; i--) {
      var a = CT[i];
      if (Math.hypot(a.x - P.x, a.z - P.z) > 330) { dropCar(a); continue; }
      var ahead = 99, lx = a.x + a.hx * 7, lz = a.z + a.hz * 7;
      for (var j = 0; j < CT.length; j++) { var o = CT[j]; if (o === a) continue; var dx = o.x - a.x, dz = o.z - a.z, fw = dx * a.hx + dz * a.hz, sd = Math.abs(dx * a.hz - dz * a.hx); if (fw > 0 && fw < 14 && sd < 2.2) ahead = Math.min(ahead, fw - (o.m.userData.L + a.m.userData.L) / 2); }
      var px = (P.mode === "car" ? taxi.x : P.x) - a.x, pz = (P.mode === "car" ? taxi.z : P.z) - a.z, pf = px * a.hx + pz * a.hz, psd = Math.abs(px * a.hz - pz * a.hx);
      if (pf > 0 && pf < 14 && psd < 2.4) ahead = Math.min(ahead, pf - a.m.userData.L / 2 - 1.2);
      var tv = ahead < 1.5 ? 0 : ahead < 10 ? a.vmax * (ahead - 1.5) / 8.5 : a.vmax;
      a.v += (tv - a.v) * Math.min(1, dt * (tv < a.v ? 4 : 1.2));
      if (!stepAgent(a, a.v * dt, 3)) { dropCar(a); continue; }
      placeAgent(a);
      a.yaw = Math.atan2(-a.hz, a.hx);
      a.m.position.set(a.x, 0.02, a.z); a.m.rotation.y = a.yaw;
      a.m.userData.wheels.forEach(function (w) { w.rotation.z -= a.v * dt / a.m.userData.r; });
    }
    for (var k = PEDS.length - 1; k >= 0; k--) {
      var pd = PEDS[k];
      if (Math.hypot(pd.x - P.x, pd.z - P.z) > 170) { removeActor(pd.a); PEDS.splice(k, 1); continue; }
      var block = Math.hypot(P.x - pd.x, P.z - pd.z) < 1.2 && ((P.x - pd.x) * pd.hx + (P.z - pd.z) * pd.hz) > 0;
      if (pd.pause > 0) { pd.pause -= dt; pd.a.play(pd.idle || "Idle"); }
      else if (!block) { if (!stepAgent(pd, pd.sp * dt, 4)) { removeActor(pd.a); PEDS.splice(k, 1); continue; } placeAgent(pd); pd.a.play("Walk", { speed: pd.sp / 1.3 }); if (Math.random() < 0.0015) { pd.pause = 3 + Math.random() * 5; pd.idle = ["Phone", "Idle", "Talk", "FoldArms"][Math.floor(Math.random() * 4)]; } }
      else pd.a.play("Idle");
      pd.a.g.position.set(pd.x, 0.07, pd.z); pd.a.g.rotation.y = Math.atan2(pd.hx, pd.hz);
    }
  }
  function spawnPed() {
    var rs = roadsNear(3); if (!rs.length) return;
    for (var tries = 0; tries < 10; tries++) {
      var r = rs[Math.floor(Math.random() * rs.length)], s = Math.random() * r.len, pt = CITY.pointAt(r, s), d = Math.hypot(pt.x - P.x, pt.z - P.z);
      if (d < 25 || d > 140) continue;
      var a = makeActor(null), pd = { a: a, r: r, dir: Math.random() < 0.5 ? 1 : -1, s: s, sp: 1.15 + Math.random() * 0.35, lane: (Math.random() < 0.5 ? 1 : -1) * (r.w / 2 + 1.9), pause: 0, x: 0, z: 0 };
      placeAgent(pd);
      if (CITY.hit(pd.x, pd.z, 0.3)) { removeActor(a); continue; }
      PEDS.push(pd); return;
    }
  }

  function startCity() {
    CITY = World.create({ scene: scene, base: cityBase, code: SERVER ? G.city : "UTR", ox: CITY_OX, oz: CITY_OZ, aniso: renderer.capabilities.getMaxAnisotropy(), onTile: drawTileOnMap, style: { brick: 0.45 } });
    return CITY.load(function (j) { $("lmsg").textContent = "BUILDING THE REAL MAP OF " + CITY_NAME.toUpperCase() + " \u00b7 " + Math.round((j.progress || 0) * 100) + "%"; $("lbar").style.width = Math.round((j.progress || 0) * 100) + "%"; }).then(function (m) {
      cityHalf = m.half;
      return fetch(cityBase + "/overview.json").then(function (r) { return r.json(); }).catch(function () { return { r: [], w: [], g: [], poi: [] }; });
    }).then(function (ov) {
      cityOV = ov; drawOverview(ov); assignPlaces(ov);
      if (!G.arrival && !(G.trip && (G.trip.stage === "boarded" || G.trip.stage === "inflight")) && !G.pos) { P.x = CITY_OX; P.z = CITY_OZ; }
      if (G.pos && !G.arrival) { P.x = G.pos[0]; P.z = G.pos[1]; }
      CITY.update(P.x, P.z, 650);
      return new Promise(function (res) {
        var t0 = performance.now(), iv = setInterval(function () {
          $("lmsg").textContent = "LOADING REAL STREETS · " + CITY.loaded() + " BLOCKS";
          pickHome();
          if ((CITY.loaded() > 6 && CITY.pending() < 6 && HOME) || performance.now() - t0 > 25000) { clearInterval(iv); pickHome(); if (HOME && !G.pos && !G.arrival) { resolveDoors(); var rd = CITY.nearestRoad(HOME.x, HOME.z, 200); P.x = HOME.x; P.z = HOME.z; if (rd) { P.yaw = Math.atan2(rd.x - HOME.x, rd.z - HOME.z); } cam.yaw = P.yaw + Math.PI; } cityReady = true; if (CITY.hit(P.x, P.z, 0.3)) unstick(false); res(); }
        }, 250);
      });
    }).catch(function (e) { console.error(e); toast("City map could not load"); });
  }

  /* ================= Interiors: go inside real buildings to work, shop, eat and live ================= */
  var INSIDE = null, INT = {}, intSlot = 0;
  var IM = {
    oak: new THREE.MeshStandardMaterial({ color: 0x9c7048, roughness: 0.55 }), walnut: new THREE.MeshStandardMaterial({ color: 0x5b3d26, roughness: 0.5 }),
    tileF: new THREE.MeshStandardMaterial({ map: canvasTex(256, 256, function (g, w, h) { g.fillStyle = "#a9a59c"; g.fillRect(0, 0, w, h); g.strokeStyle = "#8b877e"; g.lineWidth = 2; for (var i = 0; i <= w; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); } }, true), roughness: 0.3 }),
    woodF: new THREE.MeshStandardMaterial({ map: canvasTex(256, 256, function (g, w, h) { for (var i = 0; i < 16; i++) { g.fillStyle = ["#8a6240", "#7d5636", "#94693f", "#83603b"][i % 4]; g.fillRect(0, i * 16, w, 16); g.fillStyle = "rgba(0,0,0,0.18)"; g.fillRect(0, i * 16, w, 1); g.fillRect((i * 97) % w, i * 16, 1, 16); } }, true), roughness: 0.5 }),
    carpet: new THREE.MeshStandardMaterial({ color: 0x3d4757, roughness: 1 }),
    wallW: new THREE.MeshStandardMaterial({ color: 0xb9b1a4, roughness: 0.9 }), wallG: new THREE.MeshStandardMaterial({ color: 0x9fb2ad, roughness: 0.9 }), wallB: new THREE.MeshStandardMaterial({ color: 0x23313f, roughness: 0.8 }),
    fabricG: new THREE.MeshStandardMaterial({ color: 0x5f6b73, roughness: 1 }), fabricR: new THREE.MeshStandardMaterial({ color: 0x8a3a2a, roughness: 1 }), white: new THREE.MeshStandardMaterial({ color: 0xd8d6d0, roughness: 0.4 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xb8bec4, roughness: 0.25, metalness: 0.85 }), black: new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.4 }),
    screen: new THREE.MeshStandardMaterial({ color: 0x0b1a2a, emissive: 0x3a7fc4, emissiveIntensity: 0.6, roughness: 0.2 }), glass: new THREE.MeshStandardMaterial({ color: 0x9fc4d6, transparent: true, opacity: 0.35, roughness: 0.1 }),
    green: new THREE.MeshStandardMaterial({ color: 0x3f7a3a, roughness: 0.9, flatShading: true }), neon: M.neon
  };
  var PRODUCT = ["#d94a3a", "#f2c230", "#3a7fd9", "#4ab04a", "#f28c30", "#e9e6df", "#8a3ad9", "#2bb3a8"].map(function (c) { return new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 }); });
  function ib(w, h, d, mat, x, y, z, solidIt, ry) { var m = box(w, h, d, mat, x, y, z); if (ry) m.rotation.y = ry; if (solidIt) { var hw = ry ? d / 2 : w / 2, hd = ry ? w / 2 : d / 2; solid(x - hw, x + hw, z - hd, z + hd, "furn"); } return m; }
  function chair(x, z, ry, mat) { ib(0.5, 0.06, 0.5, mat || IM.black, x, 0.46, z, false); ib(0.5, 0.55, 0.06, mat || IM.black, x - Math.sin(ry) * 0.24, 0.75, z - Math.cos(ry) * 0.24, false, ry); ib(0.06, 0.44, 0.06, IM.steel, x, 0.22, z, false); }
  function desk(x, z, ry) { ib(1.5, 0.05, 0.75, IM.oak, x, 0.75, z, true, ry); ib(0.05, 0.72, 0.7, IM.steel, x - 0.7, 0.37, z, false, ry); ib(0.05, 0.72, 0.7, IM.steel, x + 0.7, 0.37, z, false, ry); var s = ib(0.62, 0.38, 0.04, IM.screen, x, 1.1, z - 0.22, false, ry); ib(0.05, 0.3, 0.05, IM.black, x, 0.88, z - 0.24); ib(0.45, 0.02, 0.15, IM.black, x, 0.78, z + 0.05); return s; }
  function shelf(x, z, w, ry) { ib(w, 2, 0.5, IM.white, x, 1, z, true, ry); for (var s = 0; s < 4; s++) for (var i = 0; i < Math.floor(w / 0.22); i++) { var p = PRODUCT[(i * 3 + s * 5 + Math.floor(x * 7)) % PRODUCT.length]; var dx = -w / 2 + 0.15 + i * 0.22; ib(0.16, 0.24 + (i % 3) * 0.04, 0.2, p, x + (ry ? 0 : dx), 0.35 + s * 0.45, z + (ry ? dx : 0.18), false); } }
  function plant(x, z) { ib(0.45, 0.45, 0.45, IM.walnut, x, 0.22, z, true); var c = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), IM.green); c.position.set(x, 1.05, z); c.castShadow = true; scene.add(c); }
  function bed(x, z, ry, big) { var w = big ? 1.9 : 1.1; ib(w, 0.4, 2.1, IM.walnut, x, 0.2, z, true, ry); ib(w - 0.1, 0.2, 2, IM.white, x, 0.5, z, false, ry); ib(w - 0.1, 0.12, 1.2, big ? IM.fabricR : IM.fabricG, x, 0.62, z + 0.35, false, ry); ib(w, 1, 0.12, IM.walnut, x, 0.6, z - 1.05, false, ry); ib(0.5, 0.14, 0.32, IM.white, x - (big ? 0.45 : 0), 0.66, z - 0.75); if (big) ib(0.5, 0.14, 0.32, IM.white, x + 0.45, 0.66, z - 0.75); }
  function sofa(x, z, ry, mat) { ib(2.2, 0.45, 0.56, mat || IM.fabricG, x, 0.25, z, true, ry); ib(2.2, 0.55, 0.2, mat || IM.fabricG, x - Math.sin(ry) * 0.38, 0.7, z - Math.cos(ry) * 0.38, true, ry); ib(0.18, 0.62, 0.76, mat || IM.fabricG, x + Math.cos(ry) * 1.1, 0.31, z - Math.sin(ry) * 1.1 - Math.cos(ry) * 0.1, false, ry); ib(0.18, 0.62, 0.76, mat || IM.fabricG, x - Math.cos(ry) * 1.1, 0.31, z + Math.sin(ry) * 1.1 - Math.cos(ry) * 0.1, false, ry); }
  function tv(x, z, ry) { ib(1.8, 0.5, 0.45, IM.walnut, x, 0.25, z, true, ry); ib(1.5, 0.85, 0.06, IM.screen, x, 1.05, z, false, ry); }
  function kitchen(x, z, w) { ib(w, 0.9, 0.65, IM.white, x, 0.45, z, true); ib(w, 0.04, 0.68, IM.black, x, 0.92, z); ib(0.6, 0.04, 0.5, IM.steel, x - w / 2 + 0.6, 0.95, z); ib(0.7, 1.9, 0.65, IM.steel, x + w / 2 + 0.4, 0.95, z, true); ib(w, 0.7, 0.35, IM.white, x, 1.9, z - 0.15); }
  function counter(x, z, w, ry) { ib(w, 1.05, 0.7, IM.walnut, x, 0.52, z, true, ry); ib(w + 0.05, 0.05, 0.78, IM.black, x, 1.07, z, false, ry); }
  function board(x, z, w) { ib(w, 1.2, 0.05, new THREE.MeshStandardMaterial({ color: 0x24402e, roughness: 0.9 }), x, 1.7, z); }
  /* where to stand so the Sit animation lands the hips on the seat (it moves the hips 0.245 m back) */
  function sitSpot(cx, cz, yaw, back) { var f = 0.245 - (back - 0.12); return { x: cx + Math.sin(yaw) * f, z: cz + Math.cos(yaw) * f }; }
  function sitNpc(kind, cx, cz, yaw, anim, back) { var p = sitSpot(cx, cz, yaw, back || 0.21); return npc(kind, p.x, p.z, yaw, anim); }
  function npc(kind, x, z, yaw, anim) { var a = makeActor(kind); a.g.position.set(x, 0.02, z); a.g.rotation.y = yaw; a.play(anim || "Idle"); staticNpcs.push(a); return a; }
  function signboard(text, x, y, z, ry) { sign(text, 4, 0.55, x, y, z, ry, { bg: "#0b0d0b", fg: "#ccff00", size: 70, w: 1024, h: 140 }); }

  /* the room shell: floor, four walls with a doorway on the south wall */
  function shellRoom(o, W, D, floor, wall, title) {
    var x0 = o.x, z0 = o.z, t = 0.2, H = 3.2, walls = [];
    plane(W, D, floor, x0, 0.03, z0);
    walls.push(box(W, H, t, wall, x0, H / 2, z0 - D / 2));
    walls.push(box(t, H, D, wall, x0 - W / 2, H / 2, z0));
    walls.push(box(t, H, D, wall, x0 + W / 2, H / 2, z0));
    walls.push(box(W / 2 - 0.8, H, t, wall, x0 - W / 4 - 0.4, H / 2, z0 + D / 2));
    walls.push(box(W / 2 - 0.8, H, t, wall, x0 + W / 4 + 0.4, H / 2, z0 + D / 2));
    walls.push(box(1.6, H - 2.4, t, wall, x0, H - (H - 2.4) / 2, z0 + D / 2));
    solid(x0 - W / 2 - 0.2, x0 + W / 2 + 0.2, z0 - D / 2 - 0.2, z0 - D / 2 + 0.1); solid(x0 - W / 2 - 0.2, x0 - W / 2 + 0.1, z0 - D / 2, z0 + D / 2); solid(x0 + W / 2 - 0.1, x0 + W / 2 + 0.2, z0 - D / 2, z0 + D / 2);
    solid(x0 - W / 2, x0 - 0.8, z0 + D / 2 - 0.1, z0 + D / 2 + 0.2); solid(x0 + 0.8, x0 + W / 2, z0 + D / 2 - 0.1, z0 + D / 2 + 0.2); solid(x0 - 1.2, x0 + 1.2, z0 + D / 2 + 0.6, z0 + D / 2 + 0.9);
    room(x0 - W / 2, x0 + W / 2, z0 - D / 2, z0 + D / 2 + 1, walls);
    var mat = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.9), IM.neon); mat.rotation.x = -Math.PI / 2; mat.position.set(x0, 0.04, z0 + D / 2 - 0.5); scene.add(mat);
    if (title) signboard(title.toUpperCase(), x0, 2.6, z0 - D / 2 + 0.12, 0);
    return { exit: { x: x0, z: z0 + D / 2 - 0.6 }, W: W, D: D };
  }
  /* zone helpers: move an existing zone (with its job data) to a spot inside, or add a new one */
  function zoneAt(id, x, z, face, r) { var f = null; ZONES.forEach(function (q) { if (q.id === id) f = q; }); if (!f) { f = { id: id, x: x, z: z, r: r || 1.4 }; ZONES.push(f); } f.x = x; f.z = z; f.r = r || 1.4; f.face = face; return f; }

  var INT_BUILD = {
    office: function (o, pl, job) {
      var s = shellRoom(o, 16, 12, IM.carpet, IM.wallW, pl.name);
      for (var r = 0; r < 2; r++) for (var c = 0; c < 4; c++) { var x = o.x - 5.4 + c * 3.6, z = o.z - 3 + r * 3.6; desk(x, z, 0); chair(x, z + 0.75, Math.PI); if (!(r === 1 && c === 1)) sitNpc(null, x, z + 0.75, Math.PI, Math.random() < 0.5 ? "Sit" : "SitTalk"); }
      plant(o.x - 7.2, o.z - 5.2); plant(o.x + 7.2, o.z - 5.2);
      var os = sitSpot(o.x - 1.8, o.z + 1.35, Math.PI, 0.21); zoneAt(job, o.x - 1.8, o.z + 1.75, Math.PI, 1.2).seat = { x: os.x, z: os.z, yaw: Math.PI, anim: "Sit" };
      return s;
    },
    bank: function (o, pl, job) {
      var s = shellRoom(o, 16, 12, IM.tileF, IM.wallG, pl.name);
      counter(o.x, o.z - 2.5, 10); for (var i = 0; i < 4; i++) { ib(0.04, 0.6, 0.7, IM.glass, o.x - 4 + i * 2.6, 1.4, o.z - 2.5); }
      npc(null, o.x - 3, o.z - 3.4, 0, "Talk"); npc(null, o.x + 3, o.z - 3.4, 0, "Interact"); npc(null, o.x, o.z - 1.6, Math.PI, "Idle"); npc(null, o.x + 3, o.z - 1.6, Math.PI, "Talk");
      ib(0.9, 1.8, 0.5, IM.steel, o.x + 7.2, 0.9, o.z + 2, true); plant(o.x - 7.2, o.z + 4);
      zoneAt(job, o.x - 0.2, o.z - 3.4, 0, 1.2);
      return s;
    },
    hotel: function (o, pl, job) {
      var s = shellRoom(o, 16, 12, IM.woodF, IM.wallW, pl.name);
      counter(o.x - 3, o.z - 3, 5); sofa(o.x + 4, o.z + 2, Math.PI, IM.fabricR); sofa(o.x + 4, o.z - 1.5, 0, IM.fabricR); ib(1.2, 0.4, 0.8, IM.walnut, o.x + 4, 0.2, o.z + 0.3, true);
      npc(null, o.x - 1.6, o.z - 3.8, 0, "Talk"); sitNpc(null, o.x + 3.5, o.z + 2, Math.PI, "Sit", 0.28); plant(o.x - 7, o.z + 4.5); plant(o.x + 7, o.z - 5);
      zoneAt(job, o.x - 3.8, o.z - 3.8, 0, 1.2);
      return s;
    },
    restaurant: function (o, pl, job) {
      var s = shellRoom(o, 16, 12, IM.woodF, IM.wallW, pl.name);
      kitchen(o.x - 2, o.z - 5.3, 8); counter(o.x - 2, o.z - 3.6, 8);
      for (var i = 0; i < 3; i++) { var tx = o.x - 5 + i * 4, tz = o.z + 1.6; ib(1.1, 0.05, 1.1, IM.oak, tx, 0.75, tz, true); ib(0.08, 0.72, 0.08, IM.steel, tx, 0.37, tz); chair(tx - 0.85, tz, Math.PI / 2); chair(tx + 0.85, tz, -Math.PI / 2); if (i !== 1) sitNpc(null, tx + 0.85, tz, -Math.PI / 2, "Eat"); }
      npc(null, o.x - 4, o.z - 4.6, 0, "Interact");
      zoneAt(job, o.x + 0.5, o.z - 4.6, 0, 1.2);
      var ds = sitSpot(o.x - 1.85, o.z + 1.6, Math.PI / 2, 0.21), ez = zoneAt("diner", o.x - 2.3, o.z + 1.6, Math.PI / 2, 1.2); ez.seat = { x: ds.x, z: ds.z, yaw: Math.PI / 2, anim: "Eat" };
      return s;
    },
    cafe: function (o, pl, job) {
      var s = shellRoom(o, 14, 10, IM.woodF, IM.wallW, pl.name);
      counter(o.x - 1, o.z - 2.6, 6); ib(0.6, 0.6, 0.5, IM.steel, o.x - 3, 1.35, o.z - 2.6); ib(0.6, 0.6, 0.5, IM.steel, o.x - 2.2, 1.35, o.z - 2.6);
      for (var i = 0; i < 3; i++) { var tx = o.x - 4 + i * 3.5, tz = o.z + 1.8; ib(0.8, 0.05, 0.8, IM.oak, tx, 0.75, tz, true); chair(tx, tz + 0.7, Math.PI); if (i !== 2) sitNpc(null, tx, tz + 0.7, Math.PI, i ? "SitTalk" : "Sit"); }
      zoneAt(job, o.x - 1, o.z - 3.4, 0, 1.2);
      return s;
    },
    shop: function (o, pl, job) {
      var s = shellRoom(o, 18, 14, IM.tileF, IM.wallW, pl.name);
      for (var i = 0; i < 4; i++) shelf(o.x - 6 + i * 3, o.z - 1.5, 4.6, Math.PI / 2);
      shelf(o.x, o.z - 6.4, 14, 0); counter(o.x + 6, o.z + 3.5, 3, 0);
      npc(null, o.x + 6, o.z + 2.6, Math.PI, "Interact"); npc(null, o.x - 4.5, o.z, Math.PI / 2, "PickUp"); npc(null, o.x + 1.5, o.z + 1, -Math.PI / 2, "Idle");
      zoneAt("grocery", o.x + 6, o.z + 4.4, Math.PI, 1.3);
      zoneAt(job, o.x - 1.5, o.z - 5.6, 0, 1.2);
      return s;
    },
    hospital: function (o, pl, job) {
      var s = shellRoom(o, 18, 12, IM.tileF, IM.wallG, pl.name);
      for (var i = 0; i < 4; i++) { bed(o.x - 6 + i * 4, o.z - 3.4, 0, false); ib(0.05, 2.2, 2.6, IM.fabricG, o.x - 4 + i * 4, 1.1, o.z - 3.4); npc(null, o.x - 6 + i * 4, o.z - 3.6, 0, i % 2 ? "Sit" : "Idle"); }
      counter(o.x + 5, o.z + 2.5, 4); npc(null, o.x + 5, o.z + 1.7, Math.PI, "Talk");
      zoneAt(job, o.x - 4, o.z - 1.7, Math.PI, 1.2);
      return s;
    },
    school: function (o, pl, job) {
      var s = shellRoom(o, 14, 12, IM.woodF, IM.wallW, pl.name);
      board(o.x, o.z - 5.85, 6);
      for (var r = 0; r < 3; r++) for (var c = 0; c < 4; c++) { var x = o.x - 4.5 + c * 3, z = o.z - 1.5 + r * 2.2; ib(1, 0.05, 0.6, IM.oak, x, 0.72, z, true); chair(x, z + 0.55, Math.PI); sitNpc(null, x, z + 0.55, Math.PI, (r + c) % 3 ? "Sit" : "SitTalk"); }
      zoneAt(job, o.x, o.z - 4.6, 0, 1.2);
      return s;
    },
    cityhall: function (o, pl) {
      var s = shellRoom(o, 16, 12, IM.tileF, IM.wallW, pl.name);
      counter(o.x, o.z - 3, 8); npc("officer", o.x - 2, o.z - 3.9, 0, "Talk"); npc("officer", o.x + 2, o.z - 3.9, 0, "Interact");
      ib(0.05, 2.2, 0.05, IM.steel, o.x - 6, 1.1, o.z - 5); var fl = ib(1.2, 0.7, 0.02, new THREE.MeshStandardMaterial({ color: 0x3a5a8c }), o.x - 5.4, 1.9, o.z - 5);
      zoneAt("cityhall", o.x, o.z - 2.2, Math.PI, 1.4);
      return s;
    },
    agency: function (o, pl) {
      var s = shellRoom(o, 12, 10, IM.carpet, IM.wallW, "Global Travel");
      desk(o.x, o.z - 1.5, 0); chair(o.x, o.z - 2.3, 0); sitNpc(null, o.x, o.z - 2.3, 0, "SitTalk"); chair(o.x, o.z - 0.6, Math.PI);
      ib(3, 1.6, 0.05, new THREE.MeshStandardMaterial({ map: canvasTex(512, 256, function (g, w, h) { var gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, "#1d4e89"); gr.addColorStop(1, "#ccff00"); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = "#fff"; g.font = "800 46px Unbounded, Arial"; g.fillText("FLY THE WORLD", 30, 140); }) }), o.x, 1.8, o.z - 4.85);
      zoneAt("agency", o.x, o.z - 0.6, Math.PI, 1.3);
      return s;
    },
    police: function (o, pl) { var s = shellRoom(o, 12, 10, IM.tileF, IM.wallB, pl.name); counter(o.x, o.z - 2, 5); npc("officer", o.x, o.z - 2.8, 0, "Talk"); zoneAt("police", o.x, o.z - 1.2, Math.PI, 1.4); return s; },
    home: function (o, pl) {
      var tier = HOME ? HOME.tier : 0, big = tier >= 2, W = [10, 14, 18, 22][tier], D = [8, 11, 13, 15][tier];
      var s = shellRoom(o, W, D, tier >= 1 ? IM.woodF : IM.carpet, tier === 3 ? IM.wallB : IM.wallW, null);
      bed(o.x - W / 2 + 1.6, o.z - D / 2 + 1.4, 0, big); sofa(o.x + 1, o.z + 0.6, Math.PI, tier === 3 ? IM.fabricR : IM.fabricG); tv(o.x + 1, o.z - D / 2 + 0.5, 0);
      kitchen(o.x + W / 2 - 2.6, o.z + D / 2 - 1.2, Math.min(4, W / 3)); plant(o.x - W / 2 + 0.6, o.z + D / 2 - 0.8);
      if (tier >= 1) { ib(1.4, 0.05, 0.9, IM.oak, o.x - 1.5, 0.75, o.z + 2.2, true); chair(o.x - 1.5, o.z + 2.9, Math.PI); }
      if (tier >= 2) { plant(o.x + W / 2 - 0.6, o.z - D / 2 + 0.6); ib(2.4, 1.8, 0.35, IM.walnut, o.x - W / 2 + 0.3, 0.9, o.z + 1, true, Math.PI / 2); }
      if (tier === 3) { for (var i = 0; i < 4; i++) ib(2.2, 2.4, 0.06, IM.glass, o.x - W / 2 + 2 + i * 2.4, 1.6, o.z - D / 2 + 0.15); var pool = plane(4, 2.2, new THREE.MeshStandardMaterial({ color: 0x2aa6c9, roughness: 0.05, metalness: 0.3 }), o.x + W / 2 - 3, 0.05, o.z - 1); }
      var hs = sitSpot(o.x + 1, o.z + 0.6, Math.PI, 0.28), rz = zoneAt("homeSofa", o.x + 1, o.z - 0.3, Math.PI, 1.3); rz.seat = { x: hs.x, z: hs.z, yaw: Math.PI, anim: "Sit" };
      zoneAt("homeBed", o.x - W / 2 + 1.6, o.z - D / 2 + 3, Math.PI, 1.3);
      zoneAt("homeFridge", o.x + W / 2 - 2.6, o.z + D / 2 - 2.1, 0, 1.3);
      return s;
    }
  };
  var PLACE_INT = { grocery: ["shop", "job:mart"], agency: ["agency"], cityhall: ["cityhall"], work: ["office", "job:office"], bank: ["bank", "job:bank"], hotel: ["hotel", "job:hotel"], diner: ["restaurant", "job:diner"], hospital: ["hospital", "job:hospital"], school: ["school", "job:school"], cafe: ["cafe", "job:cafe"], tech: ["office", "job:tech"], police: ["police"], home: ["home"] };
  function buildInterior(id) {
    if (INT[id]) return INT[id];
    var spec = PLACE_INT[id], pl = id === "home" ? HOME : cityPlaces[id];
    var o = { x: 6000 + (intSlot % 4) * 60, z: -300 + Math.floor(intSlot / 4) * 60 }; intSlot++;
    var r = INT_BUILD[spec[0]](o, { name: pl ? pl.name : id }, spec[1]);
    r.exitZone = zoneAt("exit:" + id, r.exit.x, r.exit.z, 0, 1.2); r.o = o; INT[id] = r; return r;
  }
  function enterPlace(id) {
    var pl = id === "home" ? HOME : cityPlaces[id]; if (!pl) return;
    var r = buildInterior(id);
    fadeTo(function () {
      INSIDE = { id: id, ret: { x: pl.x, z: pl.z, yaw: (pl.face || 0) + Math.PI } };
      place(r.exit.x, r.exit.z - 0.8, Math.PI, 0); cam.tdist = 7.5; cam.pitch = 0.85;
      toast(id === "home" ? "Welcome home" : "Inside " + pl.name);
      missionEvent("enter:" + id);
    });
  }
  function leavePlace() {
    if (!INSIDE) return; var ret = INSIDE.ret;
    fadeTo(function () { INSIDE = null; if (P.seat) standUp(); place(ret.x, ret.z, ret.yaw, ret.yaw + Math.PI); cam.tdist = 6.2; cam.pitch = 0.32; if (CITY && !freeAt(ret.x, ret.z)) setTimeout(function () { unstick(false); }, 120); });
  }
  function fadeTo(fn) { var f = $("fade"); f.classList.add("on"); setTimeout(function () { fn(); setTimeout(function () { f.classList.remove("on"); }, 250); }, 450); }
  function place(x, z, yaw, cy) { P.x = x; P.z = z; P.yaw = yaw; cam.yaw = cy; camera.position.set(x + Math.sin(cy) * 5, 3.5, z + Math.cos(cy) * 5); }
  /* dark backdrop around the interior area so rooms do not float in the sky */
  (function () { var bd = new THREE.Mesh(new THREE.BoxGeometry(420, 60, 420), new THREE.MeshBasicMaterial({ color: 0x0b0e12, side: THREE.BackSide, fog: false })); bd.position.set(6090, 20, -210); scene.add(bd); plane(420, 420, new THREE.MeshStandardMaterial({ color: 0x15181c, roughness: 1 }), 6090, -0.01, -210); })();
  /* ---- never get stuck: find open ground (preferably a street) and move the player there ---- */
  var stuckT = 0;
  function freeAt(a, b) { if (CITY && CITY.hit(a, b, 0.55)) return false; var q = { x: a, z: b }; collide(q, 0.32); return Math.hypot(q.x - a, q.z - b) < 0.05; }
  function trapped() {
    for (var k = 0; k < 8; k++) { var dx = Math.cos(k * Math.PI / 4), dz = Math.sin(k * Math.PI / 4), q = { x: P.x + dx * 1.2, z: P.z + dz * 1.2 }; collide(q, 0.32); if (CITY) CITY.collide(q, 0.34); if ((q.x - P.x) * dx + (q.z - P.z) * dz > 0.6) return false; }
    return true;
  }
  function freeSpot(x, z) {
    var r = CITY ? CITY.nearestRoad(x, z, 400) : null, cs = r ? [[r.x, r.z]] : []; cs.push([x, z]);
    for (var c = 0; c < cs.length; c++) for (var d = 0; d <= 40; d += 1.5) for (var k = 0; k < 12; k++) { var a = cs[c][0] + Math.cos(k * Math.PI / 6) * d, b = cs[c][1] + Math.sin(k * Math.PI / 6) * d; if (freeAt(a, b)) return { x: a, z: b }; if (!d) break; }
    return null;
  }
  function unstick(msg) {
    var f = freeSpot(P.x, P.z); if (!f) return;
    P.x = f.x; P.z = f.z; player.g.position.set(P.x, 0, P.z);
    if (msg) toast("Moved you to the street");
  }
  function sitAt(seat) { P.seat = seat; P.x = seat.x; P.z = seat.z; P.yaw = seat.yaw; player.play("SitDown", { once: true, fade: 0.2 }); setTimeout(function () { if (P.seat) player.play(seat.anim || "Sit"); }, 900); }
  function standUp() { P.seat = null; player.play("StandUp", { once: true, fade: 0.2 }); }

  /* ================= Airport cinematics: body scan + passport stamp ================= */
  var camOverride = null, armsUp = 0, SCAN_X = 112, IMM_X = 128;
  var _vA = new THREE.Vector3(), _vB = new THREE.Vector3(), _qW = new THREE.Quaternion(), _qP = new THREE.Quaternion();
  function aimBone(bone, child, dir, w) {
    if (!bone || !child) return;
    bone.getWorldPosition(_vA); child.getWorldPosition(_vB);
    var cur = _vB.sub(_vA).normalize(), sw = new THREE.Quaternion().setFromUnitVectors(cur, dir), id = new THREE.Quaternion(); sw.slerp(id, 1 - w);
    bone.getWorldQuaternion(_qW); var nw = sw.multiply(_qW); bone.parent.getWorldQuaternion(_qP); bone.quaternion.copy(_qP.invert().multiply(nw)); bone.updateMatrixWorld(true);
  }
  function poseArmsUp(a, w) {
    if (w <= 0.01) return; a.g.updateMatrixWorld(true); var q = a.g.quaternion, b = a.bones;
    [["l", 1], ["r", -1]].forEach(function (s) {
      var up = new THREE.Vector3(s[1] * 0.55, 0.83, 0.05).applyQuaternion(q).normalize(), fo = new THREE.Vector3(s[1] * 0.12, 0.99, 0.05).applyQuaternion(q).normalize();
      aimBone(b["upperarm_" + s[0]], b["lowerarm_" + s[0]], up, w); aimBone(b["lowerarm_" + s[0]], b["hand_" + s[0]], fo, w);
    });
  }
  function bodyScan(done) {
    document.body.classList.add("cinema"); P.x = SCAN_X; P.z = 0.05; P.yaw = -Math.PI / 2;
    camOverride = { pos: new THREE.Vector3(SCAN_X - 3.4, 1.6, 0.6), look: new THREE.Vector3(SCAN_X, 1.15, 0) };
    var hud = $("scanhud"); hud.hidden = false; $("scanT").textContent = "BODY SCAN"; $("scanD").textContent = "Stand still with your arms up"; $("scanBar").style.width = "0%";
    var t0 = performance.now(), dur = 3600;
    scanFlash = t0; scanSweep = { t0: t0, dur: dur };
    var iv = setInterval(function () {
      var k = (performance.now() - t0) / dur; armsUp = Math.min(1, k * 4) * (k < 0.9 ? 1 : Math.max(0, (1 - k) * 10));
      $("scanBar").style.width = Math.min(100, k * 100).toFixed(0) + "%";
      if (k >= 1) { clearInterval(iv); armsUp = 0; $("scanT").textContent = "CLEAR ✓"; $("scanD").textContent = "No items found. Have a good flight."; scanSweep = null;
        setTimeout(function () { hud.hidden = true; camOverride = null; document.body.classList.remove("cinema"); P.yaw = Math.PI / 2; cam.yaw = P.yaw + Math.PI; done(); }, 1300); }
    }, 60);
  }
  var scanSweep = null, scanCurtain = (function () { var m = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 2.2), new THREE.MeshBasicMaterial({ color: 0xccff00, transparent: true, opacity: 0.85 })); m.visible = false; scene.add(m); var c = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.4), new THREE.MeshBasicMaterial({ color: 0xccff00, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false })); c.rotation.y = Math.PI / 2; c.visible = false; scene.add(c); return { bar: m, glow: c }; })();
  function tickScan(tm) {
    if (!scanSweep) { scanCurtain.bar.visible = scanCurtain.glow.visible = false; return; }
    var k = (tm - scanSweep.t0) / scanSweep.dur, y = 0.15 + (0.5 - 0.5 * Math.cos(k * Math.PI * 4)) * 2.1;
    scanCurtain.bar.visible = scanCurtain.glow.visible = true; scanCurtain.bar.position.set(SCAN_X, y, 0); scanCurtain.glow.position.set(SCAN_X, 1.2, 0);
  }
  /* passport page with stamps, drawn on a canvas */
  function drawStamp(c, st, x, y, rot, ink) {
    var A = AIR[st.code] || here(), arr = st.kind === "in", col = ink || (arr ? "#1f4fa8" : "#a8231f");
    c.save(); c.translate(x, y); c.rotate(rot); c.strokeStyle = col; c.fillStyle = col; c.globalAlpha = 0.82;
    if (arr) { c.lineWidth = 5; c.beginPath(); c.roundRect ? c.roundRect(-110, -62, 220, 124, 14) : c.rect(-110, -62, 220, 124); c.stroke(); c.lineWidth = 2; c.beginPath(); c.roundRect ? c.roundRect(-100, -52, 200, 104, 10) : c.rect(-100, -52, 200, 104); c.stroke(); }
    else { c.lineWidth = 5; c.beginPath(); c.arc(0, 0, 74, 0, 7); c.stroke(); c.lineWidth = 2; c.beginPath(); c.arc(0, 0, 64, 0, 7); c.stroke(); }
    c.textAlign = "center"; c.textBaseline = "middle";
    c.font = "800 34px 'JetBrains Mono', monospace"; c.fillText(st.code, 0, arr ? -16 : -14);
    c.font = "700 14px 'JetBrains Mono', monospace"; c.fillText((arr ? "ADMITTED" : "DEPARTED") + " · " + (A.country || "").toUpperCase().slice(0, 14), 0, arr ? 14 : 12);
    c.font = "700 15px 'JetBrains Mono', monospace"; c.fillText(st.date || "", 0, arr ? 36 : 32);
    c.font = "800 20px Arial"; c.fillText(arr ? "✈ ←" : "✈ →", 0, arr ? -44 : -44);
    c.globalCompositeOperation = "destination-out"; for (var i = 0; i < 260; i++) { c.globalAlpha = Math.random() * 0.6; c.fillRect(-120 + Math.random() * 240, -80 + Math.random() * 160, 2 + Math.random() * 3, 2 + Math.random() * 3); }
    c.restore();
  }
  function drawPage(c, stamps, upto) {
    var w = 560, h = 760; c.globalCompositeOperation = "source-over"; c.globalAlpha = 1;
    var gr = c.createLinearGradient(0, 0, w, h); gr.addColorStop(0, "#f3ecd8"); gr.addColorStop(1, "#e6dcc0"); c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.strokeStyle = "rgba(60,90,120,0.10)"; c.lineWidth = 1; for (var i = 0; i < 60; i++) { c.beginPath(); for (var x = 0; x <= w; x += 8) { var y = i * 14 + Math.sin(x / 40 + i) * 6; if (x) c.lineTo(x, y); else c.moveTo(x, y); } c.stroke(); }
    c.fillStyle = "rgba(19,36,74,0.75)"; c.font = "800 18px 'JetBrains Mono', monospace"; c.textAlign = "center"; c.fillText("VISAS  ·  STAMPS", w / 2, 40);
    c.fillStyle = "rgba(19,36,74,0.4)"; c.font = "600 12px 'JetBrains Mono', monospace"; c.fillText("EARTHPASS · " + G.passport.no, w / 2, h - 22);
    stamps.slice(Math.max(0, upto - 6), upto).forEach(function (st, i) { var r = rng(i * 13 + st.t % 997); drawStamp(c, st, 150 + (i % 2) * 260 + (r() - 0.5) * 30, 150 + Math.floor(i / 2) * 200 + (r() - 0.5) * 30, (r() - 0.5) * 0.5); });
  }
  function stampSequence(st, caption, done) {
    var ov = $("stampov"), cv = $("scv"), c = cv.getContext("2d"), list = G.stamps.concat([st]), n = list.length, idx = Math.min(5, n - 1) ;
    drawPage(c, G.stamps, G.stamps.length); ov.hidden = false; $("scap").textContent = "";
    var sp = $("stamper"); sp.classList.remove("go"); void sp.offsetWidth; sp.classList.add("go");
    var pos = Math.min(n, 6) - 1, px = 150 + (pos % 2) * 260, py = 150 + Math.floor(pos / 2) * 200;
    sp.style.left = (px / 560 * 100) + "%"; sp.style.top = (py / 760 * 100) + "%";
    setTimeout(function () { drawPage(c, list, n); var o = $("spage") || ov.querySelector(".spage"); o.style.transform = "rotate(-3deg) translateY(4px)"; setTimeout(function () { o.style.transform = ""; }, 120); $("scap").textContent = caption; }, 680);
    setTimeout(function () { ov.hidden = true; done(); }, 2900);
  }
  /* ================= Cinematic cutscenes (Vice City style camera moves) ================= */
  var CUT = null;
  var DESK = (function () {
    var g = {}, PX = 127.7;
    var scan = box(0.42, 0.08, 0.34, M.dark, PX + 0.35, 1.36, -3.35, { shadow: false });
    var glassTop = box(0.34, 0.01, 0.26, new THREE.MeshStandardMaterial({ color: 0x1b3550, emissive: 0x0a2a44, emissiveIntensity: 0.6, roughness: 0.1 }), PX + 0.35, 1.405, -3.35, { shadow: false });
    var led = box(0.04, 0.03, 0.04, new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff2020, emissiveIntensity: 1.2 }), PX + 0.52, 1.42, -3.24, { shadow: false });
    var beam = box(0.02, 0.012, 0.26, new THREE.MeshBasicMaterial({ color: 0xccff00 }), PX + 0.2, 1.42, -3.35, { shadow: false }); beam.visible = false;
    var mc = document.createElement("canvas"); mc.width = 512; mc.height = 320; var mt = new THREE.CanvasTexture(mc); mt.encoding = THREE.sRGBEncoding;
    var mon = box(0.62, 0.4, 0.04, new THREE.MeshBasicMaterial({ map: mt, toneMapped: false }), PX - 0.35, 1.62, -3.72, { shadow: false }); mon.rotation.y = 0.35;
    box(0.66, 0.44, 0.03, M.dark, PX - 0.35 - 0.01, 1.62, -3.75, { shadow: false }).rotation.y = 0.35;
    function screen(state, photo) {
      var c = mc.getContext("2d"); c.fillStyle = "#07121c"; c.fillRect(0, 0, 512, 320); c.fillStyle = "#ccff00"; c.fillRect(0, 0, 512, 34);
      c.fillStyle = "#07121c"; c.font = "800 18px 'JetBrains Mono', monospace"; c.fillText("BORDER CONTROL · " + here().code, 14, 23);
      if (photo) { c.drawImage(photo, 18, 52, 150, 190); c.strokeStyle = "#ccff00"; c.lineWidth = 3; c.strokeRect(18, 52, 150, 190); }
      c.fillStyle = "#e9ece6"; c.font = "700 20px 'JetBrains Mono', monospace";
      c.fillText((G.passport.last || "").toUpperCase(), 190, 78); c.fillText((G.passport.first || "").toUpperCase(), 190, 104);
      c.font = "600 16px 'JetBrains Mono', monospace"; c.fillStyle = "#9aa392"; c.fillText("PASSPORT " + G.passport.no, 190, 134); c.fillText("NATIONALITY USA", 190, 158);
      c.font = "800 26px Unbounded, Arial"; c.fillStyle = state === "match" ? "#ccff00" : state === "scan" ? "#ffb02e" : "#9aa392";
      c.fillText(state === "match" ? "MATCH ✓ 98.7%" : state === "scan" ? "SCANNING…" : "WAITING", 190, 214);
      if (state === "scan") { c.fillStyle = "rgba(204,255,0,0.5)"; c.fillRect(18, 52 + (performance.now() / 6) % 190, 150, 3); }
      mt.needsUpdate = true;
    }
    screen("wait");
    var pp = new THREE.Group(); var cover = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.012, 0.175), new THREE.MeshStandardMaterial({ color: 0x13244a, roughness: 0.5 })); pp.add(cover);
    var gold = new THREE.Mesh(new THREE.CircleGeometry(0.028, 20), new THREE.MeshStandardMaterial({ color: 0xd8b04a, metalness: 0.9, roughness: 0.3 })); gold.rotation.x = -Math.PI / 2; gold.position.y = 0.007; pp.add(gold);
    var paper = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.003, 0.09), new THREE.MeshStandardMaterial({ color: 0xf4f2ea, roughness: 0.8 })); paper.position.set(0.02, 0.012, 0.03); paper.rotation.y = 0.3; pp.add(paper);
    pp.visible = false; scene.add(pp);
    g.scan = scan; g.led = led; g.beam = beam; g.screen = screen; g.pp = pp; g.PX = PX;
    return g;
  })();
  var FLY = null;
  function flyProp(obj, from, to, dur, lift) { obj.visible = true; FLY = { o: obj, a: from.clone(), b: to.clone(), t0: performance.now(), dur: dur, lift: lift || 0.25 }; }
  function handPos() { var v = new THREE.Vector3(); if (player.bones.hand_r) player.bones.hand_r.getWorldPosition(v); else v.set(P.x, 1.1, P.z); return v; }
  function V(a) { return new THREE.Vector3(a[0], a[1], a[2]); }
  function ease(k) { return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; }
  function cutscene(shots, done) {
    document.body.classList.add("cinema");
    CUT = { shots: shots, i: -1, t0: 0, done: done };
    nextShot();
  }
  function nextShot() {
    CUT.i++; if (CUT.i >= CUT.shots.length) { var d = CUT.done; CUT = null; camOverride = null; document.body.classList.remove("cinema"); if (d) d(); return; }
    CUT.t0 = performance.now(); var s = CUT.shots[CUT.i]; if (s.at) s.at();
  }
  function tickCut(tm) {
    if (FLY) { var k = Math.min(1, (tm - FLY.t0) / FLY.dur), e = ease(k); FLY.o.position.lerpVectors(FLY.a, FLY.b, e); FLY.o.position.y += Math.sin(k * Math.PI) * FLY.lift; FLY.o.rotation.y = e * 0.6; if (k >= 1) FLY = null; }
    if (!CUT) return;
    var s = CUT.shots[CUT.i], k2 = Math.min(1, (tm - CUT.t0) / (s.dur * (window.__cutSlow || 1))), e2 = ease(k2);
    camOverride = { exact: true, pos: V(s.from.p).lerp(V(s.to ? s.to.p : s.from.p), e2), look: V(s.from.l).lerp(V(s.to ? s.to.l : s.from.l), e2) };
    if (s.tick) s.tick(k2);
    if (k2 >= 1) nextShot();
  }
  function findNpc(x, z) { return staticNpcs.filter(function (n) { return Math.abs(n.g.position.x - x) < 1.2 && Math.abs(n.g.position.z - z) < 1.2; })[0]; }

  function immigrationSequence(a, arr) {
    var PX = DESK.PX, off = findNpc(PX, -4.05) || findNpc(IMM_X + 0.3, -3.6);
    if (off) { off.g.position.set(PX, 0.05, -4.05); off.g.rotation.y = 0; }
    P.x = PX; P.z = -2.35; P.yaw = Math.PI; P.v = 0;
    var photo = new Image(); try { photo.src = People.portrait(renderer, player.traits, 150, 190); } catch (e) {}
    var scanAt = new THREE.Vector3(PX + 0.35, 1.43, -3.35), st = { code: a.code, kind: arr ? "in" : "out", t: now(), date: fmtD(now(), a.tz).toUpperCase().replace(/^\w+,?\s*/, "") };
    cutscene([
      { dur: 1700, from: { p: [PX - 1.6, 2.1, 0.6], l: [PX, 1.4, -3.6] }, to: { p: [PX - 0.75, 1.8, -0.9], l: [PX + 0.1, 1.35, -3.6] }, at: function () { player.play("Interact", { restart: true }); passportProp.visible = true; } },
      { dur: 1600, from: { p: [PX - 1.7, 1.55, -2.5], l: [PX + 0.2, 1.3, -3.1] }, to: { p: [PX - 1.35, 1.5, -2.8], l: [PX + 0.25, 1.32, -3.2] }, at: function () { passportProp.visible = false; flyProp(DESK.pp, handPos(), scanAt, 1100, 0.18); if (off) off.play("Interact", { restart: true }); } },
      { dur: 2000, from: { p: [PX + 0.85, 1.8, -2.55], l: [PX + 0.35, 1.36, -3.35] }, to: { p: [PX + 0.5, 1.62, -2.85], l: [PX + 0.35, 1.36, -3.35] }, at: function () { DESK.beam.visible = true; DESK.screen("scan", photo); },
        tick: function (k) { DESK.beam.position.x = PX + 0.2 + Math.abs(Math.sin(k * Math.PI * 3)) * 0.3; if (k > 0.75) { DESK.led.material.emissive.setHex(0x20ff40); DESK.screen("match", photo); } else DESK.screen("scan", photo); } },
      { dur: 1400, from: { p: [PX + 0.4, 1.75, -2.3], l: [PX - 0.25, 1.5, -3.9] }, to: { p: [PX + 0.25, 1.7, -2.6], l: [PX - 0.3, 1.5, -3.9] }, at: function () { DESK.beam.visible = false; if (off) off.play("Talk"); } },
      { dur: 3000, from: { p: [PX + 0.25, 1.7, -2.6], l: [PX - 0.3, 1.5, -3.9] }, at: function () { stampSequence(st, arr ? "WELCOME TO " + a.country.toUpperCase() : "EXIT STAMP · HAVE A SAFE TRIP", function () {}); } },
      { dur: 1600, from: { p: [PX + 1.3, 1.9, -0.7], l: [PX, 1.35, -3.0] }, to: { p: [PX + 0.6, 2.2, 1.6], l: [PX, 1.3, -2.4] }, at: function () { if (off) off.play("Yes", { restart: true }); flyProp(DESK.pp, scanAt, handPos(), 1000, 0.15); setTimeout(function () { DESK.pp.visible = false; passportProp.visible = true; player.play("Yes", { restart: true }); }, 1000); } }
    ], function () {
      passportProp.visible = false; DESK.led.material.emissive.setHex(0xff2020); DESK.screen("wait");
      G.stamps.push(st); if (arr) G.flags.entry = true; else G.flags.immigration = true;
      save(); applyBlocks(); if (off) off.play("Idle"); player.play("Idle"); P.x = IMM_X - 2.2; P.z = 0; P.yaw = Math.PI / 2; cam.yaw = P.yaw + Math.PI;
      toast((arr ? "Entry" : "Exit") + " stamp · " + a.code); missionEvent(arr ? "entry" : "immigrationDone");
    });
  }
  /* check-in: hand over passport and ticket, agent scans, boarding pass prints */
  var PRINTED = (function () { var m = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.003, 0.08), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x222222 })); m.visible = false; scene.add(m); return m; })();
  function checkinSequence(done) {
    var ag = findNpc(98, -17.6); if (ag) { ag.g.position.set(98, 0.05, -17.0); ag.g.rotation.y = 0; }
    P.x = 98; P.z = -14.85; P.yaw = Math.PI; P.v = 0;
    var desk = new THREE.Vector3(98, 1.2, -16), printer = new THREE.Vector3(99.9, 0.72, -15.2);
    cutscene([
      { dur: 1600, from: { p: [99.8, 1.9, -12.6], l: [98, 1.3, -16.6] }, to: { p: [99.0, 1.7, -13.6], l: [98, 1.25, -16.4] }, at: function () { player.play("Interact", { restart: true }); passportProp.visible = true; } },
      { dur: 1500, from: { p: [96.4, 1.5, -15.0], l: [98.2, 1.2, -16] }, to: { p: [96.7, 1.45, -15.3], l: [98.2, 1.2, -16] }, at: function () { passportProp.visible = false; flyProp(DESK.pp, handPos(), desk, 1000, 0.15); if (ag) ag.play("PickUp", { restart: true }); } },
      { dur: 1900, from: { p: [98.6, 1.75, -15.1], l: [98, 1.2, -16.6] }, to: { p: [98.3, 1.7, -15.4], l: [98, 1.3, -16.9] }, at: function () { if (ag) ag.play("Interact", { restart: true }); } },
      { dur: 1700, from: { p: [101.2, 1.2, -14.4], l: [99.9, 0.72, -15.2] }, to: { p: [100.9, 1.1, -14.7], l: [99.9, 0.72, -15.2] }, at: function () { PRINTED.visible = true; PRINTED.position.copy(printer); },
        tick: function (k) { PRINTED.position.set(99.9 - 0.05 + k * 0.16, 0.73, -15.2); } },
      { dur: 1500, from: { p: [99.5, 1.9, -12.9], l: [98, 1.3, -15.8] }, to: { p: [98.4, 2.3, -11.4], l: [98, 1.3, -15.2] }, at: function () { PRINTED.visible = false; flyProp(DESK.pp, desk, handPos(), 900, 0.12); if (ag) ag.play("Yes", { restart: true }); setTimeout(function () { DESK.pp.visible = false; passportProp.visible = true; }, 900); } }
    ], function () { passportProp.visible = false; if (ag) ag.play("Idle"); P.x = 98; P.z = -13.6; P.yaw = 0; cam.yaw = P.yaw + Math.PI; done(); });
  }

  $("pB").addEventListener("click", function () {
    if (!curZone) return;
    if (curZone.z.id === "car") { exitTaxi(); return; }
    act(curZone.z); curZone = null; $("prompt").hidden = true;
  });
  window.__pw = { checkinSequence: checkinSequence, immigrationSequence2: function(){ return immigrationSequence(here(), false); }, stampSequence: stampSequence, bodyScan: bodyScan, immigrationSequence: immigrationSequence, here: here, cityPlaces: cityPlaces, CITY: function () { return CITY; }, drive: drive, enterTaxi: enterTaxi, exitTaxi: exitTaxi, carHits: carHits, collide: collide, carPush: carPush, COL: COL, CARS: CARS, openMap: openMap, setWaypoint: setWaypoint, P: P, cam: cam, G: G, zones: ZONES, act: act, setSpeed: setSpeed, taxi: taxi, board: board, applyBlocks: applyBlocks, refreshSigns: refreshSigns, save: save, enterPlace: enterPlace, leavePlace: leavePlace, home: function () { return HOME; }, inside: function () { return INSIDE; }, unstick: unstick, trapped: trapped, freeAt: freeAt, player: function () { return player; }, sitAt: sitAt, zone: function (id) { return ZONES.filter(function (z) { return z.id === id; })[0]; } };
  window.addEventListener("beforeunload", save);
  document.addEventListener("visibilitychange", function () { if (document.hidden) save(); });
})();
