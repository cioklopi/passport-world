/* Passport World - people: CC0 Quaternius base characters + Universal Animation Library clips,
   clothing shells generated from the body mesh, appearance from passport traits. */
(function () {
  "use strict";
  var T = THREE, LOADER = null, SRC = {}, CLIPS = {}, HAIR = {}, TEX = {}, READY = null;
  var HAIRS = ["Hair_SimpleParted", "Hair_Buzzed", "Hair_Long", "Hair_Buns", "Hair_BuzzedFemale", "Hair_Beard", "Eyebrows_Regular", "Eyebrows_Female"];
  function parse(text) { return new Promise(function (res, rej) { LOADER.parse(text, "", res, rej); }); }
  function getText(u) { return fetch(u).then(function (r) { if (!r.ok) throw new Error(u + " " + r.status); return r.text(); }); }
  function texLoad(u, srgb) { return new Promise(function (res) { new T.TextureLoader().load(u, function (t) { t.flipY = false; if (srgb) t.encoding = T.sRGBEncoding; t.anisotropy = 4; res(t); }, undefined, function () { res(null); }); }); }

  function load(base, onProgress) {
    if (READY) return READY;
    LOADER = new T.GLTFLoader();
    var jobs = [], done = 0, tick = function (x) { done++; if (onProgress) onProgress(done / jobs.length); return x; };
    jobs.push(getText(base + "male.json").then(parse).then(function (g) { SRC.M = g; return tick(); }));
    jobs.push(getText(base + "female.json").then(parse).then(function (g) { SRC.F = g; return tick(); }));
    jobs.push(getText(base + "anim1.json").then(parse).then(function (g) { g.animations.forEach(function (c) { CLIPS[c.name] = c; }); return tick(); }));
    jobs.push(getText(base + "anim2.json").then(parse).then(function (g) { g.animations.forEach(function (c) { CLIPS[c.name] = c; }); return tick(); }));
    HAIRS.forEach(function (h) { jobs.push(getText(base + "hair_" + h + ".json").then(parse).then(function (g) { var m = null; g.scene.traverse(function (o) { if (o.isSkinnedMesh && !m) m = o; }); HAIR[h] = m; return tick(); })); });
    [["male_light", 1], ["male_dark", 1], ["female_light", 1], ["female_dark", 1], ["hair1", 1], ["hair2", 1], ["hair1_n", 0], ["hair2_n", 0]].forEach(function (t) {
      jobs.push(texLoad(base + t[0] + (t[0].slice(-2) === "_n" ? ".png" : ".jpg"), t[1]).then(function (x) { TEX[t[0]] = x; return tick(); }));
    });
    READY = Promise.all(jobs).then(function () { prepRegions("M"); prepRegions("F"); fixClips(); });
    return READY;
  }
  /* body regions per vertex (dominant bone) */
  var REG = {};
  function bodyMesh(src) { var b = null; src.scene.traverse(function (o) { if (o.isSkinnedMesh && /Superhero|SuperHero|Retopology/i.test(o.name + (o.material && o.material.name)) && (!b || o.geometry.attributes.position.count > b.geometry.attributes.position.count)) b = o; }); return b; }
  function prepRegions(sx) {
    var b = bodyMesh(SRC[sx]); if (!b) return;
    var g = b.geometry, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, n = si.count, bones = b.skeleton.bones, reg = new Uint8Array(n);
    var map = {}; bones.forEach(function (bn, i) { var nm = bn.name;
      map[i] = /^(spine_01|spine_02|spine_03|clavicle_[lr])$/.test(nm) ? 1 : /^upperarm/.test(nm) ? 2 : /^lowerarm/.test(nm) ? 3 : /^pelvis$/.test(nm) ? 4 : /^thigh/.test(nm) ? 5 : /^calf/.test(nm) ? 6 : /^(foot|ball)/.test(nm) ? 7 : /^(neck|Head)/.test(nm) ? 8 : /^hand|thumb|index|middle|ring|pinky/.test(nm) ? 9 : 0; });
    var GW = [function (at, i) { return at.getX(i); }, function (at, i) { return at.getY(i); }, function (at, i) { return at.getZ(i); }, function (at, i) { return at.getW(i); }];
    for (var v = 0; v < n; v++) { var bi = 0, bw = -1; for (var k = 0; k < 4; k++) { var w = GW[k](sw, v); if (w > bw) { bw = w; bi = GW[k](si, v); } } reg[v] = map[bi] || 0; }
    var pos = g.attributes.position, minY = 1e9, maxY = -1e9; for (var i = 0; i < n; i++) { var y = pos.getY(i); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    REG[sx] = { reg: reg, minY: minY, maxY: maxY, body: b };
  }
  function fixClips() {
    /* keep only rotation tracks plus pelvis position so the base characters keep their own proportions */
    Object.keys(CLIPS).forEach(function (k) { var c = CLIPS[k]; c.tracks = c.tracks.filter(function (t) { return /\.quaternion$/.test(t.name) || /^pelvis\.position$/.test(t.name); }); });
  }

  /* procedural fabric textures */
  var FAB = {};
  function fabric(kind) {
    if (FAB[kind]) return FAB[kind];
    var c = document.createElement("canvas"); c.width = c.height = 128; var g = c.getContext("2d");
    g.fillStyle = "#fff"; g.fillRect(0, 0, 128, 128);
    var i;
    if (kind === "denim") { for (i = 0; i < 128; i += 2) { g.fillStyle = "rgba(0,0,0," + (0.06 + Math.random() * 0.06) + ")"; g.fillRect(0, i, 128, 1); } for (i = -128; i < 128; i += 3) { g.strokeStyle = "rgba(255,255,255,0.12)"; g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 128, 128); g.stroke(); } }
    else if (kind === "knit") { for (var y = 0; y < 128; y += 4) for (var x = 0; x < 128; x += 4) { g.fillStyle = "rgba(0,0,0," + (0.04 + ((x + y) % 8 ? 0.03 : 0.07)) + ")"; g.fillRect(x, y, 3, 3); } }
    else if (kind === "suit") { for (i = 0; i < 128; i += 1) { g.fillStyle = "rgba(0,0,0," + (Math.random() * 0.05) + ")"; g.fillRect(0, i, 128, 1); } }
    else if (kind === "leather") { for (i = 0; i < 900; i++) { g.fillStyle = "rgba(0,0,0," + Math.random() * 0.12 + ")"; g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2); } }
    for (i = 0; i < 2000; i++) { g.fillStyle = "rgba(0,0,0," + Math.random() * 0.04 + ")"; g.fillRect(Math.random() * 128, Math.random() * 128, 1, 1); }
    var t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(10, 10); t.encoding = T.sRGBEncoding; FAB[kind] = t; return t;
  }
  function col(h) { return new T.Color(h).convertSRGBToLinear(); }

  /* build a skinned "shell" around selected body regions */
  function shell(body, regionInfo, regs, thick, colorFn, mat, only) {
    var g = body.geometry, pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, idx = g.index, R = regionInfo.reg;
    var keep = new Uint8Array(pos.count); for (var i = 0; i < pos.count; i++) keep[i] = regs.indexOf(R[i]) >= 0 && (!only || only(pos.getY(i), R[i])) ? 1 : 0;
    var tris = []; var ix = idx ? idx.array : null, tc = ix ? ix.length : pos.count;
    for (var t = 0; t < tc; t += 3) { var a = ix ? ix[t] : t, b = ix ? ix[t + 1] : t + 1, c = ix ? ix[t + 2] : t + 2; if (keep[a] + keep[b] + keep[c] >= 2) tris.push(a, b, c); }
    var remap = new Map(), P = [], N = [], U = [], SI = [], SW = [], C = [], I = [], TH = [];
    for (var q = 0; q < tris.length; q++) {
      var v = tris[q], ni = remap.get(v);
      if (ni === undefined) {
        ni = remap.size; remap.set(v, ni);
        var nx = nor.getX(v), ny = nor.getY(v), nz = nor.getZ(v), th = typeof thick === "function" ? thick(v, R[v]) : thick;
        P.push(pos.getX(v) + nx * th, pos.getY(v) + ny * th, pos.getZ(v) + nz * th); TH.push(th); N.push(nx, ny, nz); U.push(uv ? uv.getX(v) : 0, uv ? uv.getY(v) : 0);
        SI.push(si.getX(v), si.getY(v), si.getZ(v), si.getW(v)); SW.push(sw.getX(v), sw.getY(v), sw.getZ(v), sw.getW(v));
        var cc = colorFn(pos.getX(v), pos.getY(v), pos.getZ(v), R[v], nx, ny, nz); C.push(cc.r, cc.g, cc.b);
      }
      I.push(ni);
    }
    /* soften muscles: laplacian smoothing, then keep the cloth outside the skin */
    var nv = remap.size, gid = new Int32Array(nv), keys = new Map(), ng0 = 0;
    for (var z = 0; z < nv; z++) { var kk = Math.round(P[z * 3] * 2000) + "," + Math.round(P[z * 3 + 1] * 2000) + "," + Math.round(P[z * 3 + 2] * 2000), gg = keys.get(kk); if (gg === undefined) { gg = ng0++; keys.set(kk, gg); } gid[z] = gg; }
    var GP = new Float32Array(ng0 * 3), GN = new Float32Array(ng0 * 3), adj = new Array(ng0); for (var z2 = 0; z2 < ng0; z2++) adj[z2] = new Set();
    for (var z3 = 0; z3 < nv; z3++) { var g3 = gid[z3]; GP[g3 * 3] = P[z3 * 3]; GP[g3 * 3 + 1] = P[z3 * 3 + 1]; GP[g3 * 3 + 2] = P[z3 * 3 + 2]; GN[g3 * 3] += N[z3 * 3]; GN[g3 * 3 + 1] += N[z3 * 3 + 1]; GN[g3 * 3 + 2] += N[z3 * 3 + 2]; }
    for (var e = 0; e < I.length; e += 3) { var A = gid[I[e]], B = gid[I[e + 1]], Cc = gid[I[e + 2]]; adj[A].add(B).add(Cc); adj[B].add(A).add(Cc); adj[Cc].add(A).add(B); }
    var GO = GP.slice(), GQ = GP.slice(), AL = adj.map(function (x) { return Array.from(x); });
    for (var it = 0; it < 8; it++) {
      for (var vv = 0; vv < ng0; vv++) { var nb = AL[vv]; if (!nb.length) continue; var sx = 0, sy = 0, sz = 0; for (var m2 = 0; m2 < nb.length; m2++) { sx += GP[nb[m2] * 3]; sy += GP[nb[m2] * 3 + 1]; sz += GP[nb[m2] * 3 + 2]; } var k2 = 0.55 / nb.length; GQ[vv * 3] = GP[vv * 3] * 0.45 + sx * k2; GQ[vv * 3 + 1] = GP[vv * 3 + 1] * 0.45 + sy * k2; GQ[vv * 3 + 2] = GP[vv * 3 + 2] * 0.45 + sz * k2; }
      var tmp = GP; GP = GQ; GQ = tmp;
    }
    for (var g4 = 0; g4 < ng0; g4++) { var nl = Math.hypot(GN[g4 * 3], GN[g4 * 3 + 1], GN[g4 * 3 + 2]) || 1, nx4 = GN[g4 * 3] / nl, ny4 = GN[g4 * 3 + 1] / nl, nz4 = GN[g4 * 3 + 2] / nl, d4 = (GP[g4 * 3] - GO[g4 * 3]) * nx4 + (GP[g4 * 3 + 1] - GO[g4 * 3 + 1]) * ny4 + (GP[g4 * 3 + 2] - GO[g4 * 3 + 2]) * nz4; if (d4 < 0) { GP[g4 * 3] -= nx4 * d4; GP[g4 * 3 + 1] -= ny4 * d4; GP[g4 * 3 + 2] -= nz4 * d4; } }
    /* clean hems: straighten the jagged open edges (cuffs, collar, waist) and tuck them onto the skin */
    var GT = new Float32Array(ng0); for (var z6 = 0; z6 < nv; z6++) GT[gid[z6]] = TH[z6];
    var EC = new Map(); for (var e2 = 0; e2 < I.length; e2 += 3) { var tri = [gid[I[e2]], gid[I[e2 + 1]], gid[I[e2 + 2]]]; for (var k3 = 0; k3 < 3; k3++) { var a3 = tri[k3], b3 = tri[(k3 + 1) % 3], ek = a3 < b3 ? a3 + "_" + b3 : b3 + "_" + a3; EC.set(ek, (EC.get(ek) || 0) + 1); } }
    var BN = new Map(); EC.forEach(function (cnt, ek) { if (cnt !== 1) return; var ab = ek.split("_"), a4 = +ab[0], b4 = +ab[1]; (BN.get(a4) || BN.set(a4, []).get(a4)).push(b4); (BN.get(b4) || BN.set(b4, []).get(b4)).push(a4); });
    for (var it2 = 0; it2 < 14; it2++) { var NP = new Map(); BN.forEach(function (nb2, vb) { if (nb2.length !== 2) return; var p0 = nb2[0] * 3, p1 = nb2[1] * 3, pv = vb * 3; NP.set(vb, [GP[pv] * 0.5 + (GP[p0] + GP[p1]) * 0.25, GP[pv + 1] * 0.5 + (GP[p0 + 1] + GP[p1 + 1]) * 0.25, GP[pv + 2] * 0.5 + (GP[p0 + 2] + GP[p1 + 2]) * 0.25]); }); NP.forEach(function (q3, vb) { GP[vb * 3] = q3[0]; GP[vb * 3 + 1] = q3[1]; GP[vb * 3 + 2] = q3[2]; }); }
    BN.forEach(function (nb2, vb) { var nl2 = Math.hypot(GN[vb * 3], GN[vb * 3 + 1], GN[vb * 3 + 2]) || 1, t2 = GT[vb] * 0.75; GP[vb * 3] -= GN[vb * 3] / nl2 * t2; GP[vb * 3 + 1] -= GN[vb * 3 + 1] / nl2 * t2; GP[vb * 3 + 2] -= GN[vb * 3 + 2] / nl2 * t2; });
    var O = P.slice(); for (var z5 = 0; z5 < nv; z5++) { var g5 = gid[z5]; P[z5 * 3] = GP[g5 * 3]; P[z5 * 3 + 1] = GP[g5 * 3 + 1]; P[z5 * 3 + 2] = GP[g5 * 3 + 2]; }
    if (false) {
    }
    for (var w2 = 0; w2 < 0; w2++) { var dx = P[w2 * 3] - O[w2 * 3], dy = P[w2 * 3 + 1] - O[w2 * 3 + 1], dz = P[w2 * 3 + 2] - O[w2 * 3 + 2], d = dx * N[w2 * 3] + dy * N[w2 * 3 + 1] + dz * N[w2 * 3 + 2]; if (d < 0) { P[w2 * 3] -= N[w2 * 3] * d; P[w2 * 3 + 1] -= N[w2 * 3 + 1] * d; P[w2 * 3 + 2] -= N[w2 * 3 + 2] * d; } }
    var ng = new T.BufferGeometry();
    ng.setAttribute("position", new T.Float32BufferAttribute(P, 3)); ng.setAttribute("normal", new T.Float32BufferAttribute(N, 3)); ng.setAttribute("uv", new T.Float32BufferAttribute(U, 2));
    ng.setAttribute("skinIndex", new T.Uint16BufferAttribute(SI, 4)); ng.setAttribute("skinWeight", new T.Float32BufferAttribute(SW, 4)); ng.setAttribute("color", new T.Float32BufferAttribute(C, 3)); ng.setIndex(I); ng.computeVertexNormals();
    var m = new T.SkinnedMesh(ng, mat); m.bind(body.skeleton, body.bindMatrix); m.castShadow = true; m.frustumCulled = false; return m;
  }

  /* ---------- traits ---------- */
  var SKIN = ["#f6d7c3", "#eac0a0", "#d9a27c", "#b77a52", "#8a5634", "#5e3a22"];
  var HAIRC = ["#1c1512", "#3b2618", "#5a3a22", "#8a5a33", "#b8894f", "#d9b977", "#a33a1f", "#6b6b6b", "#d8d4cc"];
  var TOPS = ["tshirt", "shirt", "jacket", "hoodie", "suit", "polo", "blazer"], BOTS = ["jeans", "chinos", "slacks", "shorts", "jeans"];
  var CLOTH = ["#1f2a44", "#2b2b2e", "#f2f0ea", "#8a1c1c", "#2f6b4f", "#3a5a8c", "#4b5d8a", "#5a3a2a", "#5e5e66", "#13306b", "#0f3d3a", "#b8d400", "#c7552b", "#6a3d8a", "#d8dde4", "#7d1f3f"];
  function traitsFor(seed, sex, rarity) {
    var r = (function (a) { return function () { a = (a + 0x6d2b79f5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })(seed * 7919 + 13);
    var pick = function (a) { return a[Math.floor(r() * a.length)]; };
    var s = sex || (r() < 0.5 ? "M" : "F"), fancy = rarity === "Legendary" || rarity === "Epic";
    var hair = s === "M" ? pick(["Hair_SimpleParted", "Hair_Buzzed", "Hair_SimpleParted", "Hair_Long", "Hair_Buzzed"]) : pick(["Hair_Long", "Hair_Buns", "Hair_BuzzedFemale", "Hair_Long", "Hair_SimpleParted"]);
    var top = fancy ? pick(["suit", "blazer", "suit", "shirt"]) : pick(TOPS);
    return { sex: s, skin: Math.floor(r() * SKIN.length), hair: hair, hairColor: pick(HAIRC), beard: s === "M" && r() < 0.4, top: top, bottom: top === "suit" ? "slacks" : pick(BOTS),
      c1: pick(CLOTH), c2: pick(CLOTH), c3: pick(["#1f2a44", "#2b2b2e", "#3d5a8a", "#c9b48e", "#5e5e66", "#7a4a2a"]), shoes: pick(["#1a1a1a", "#f2f0ea", "#5a3a22", "#2b2b2e", "#8a1c1c"]), eye: pick(["#4a2f1f", "#2f4a6b", "#3d5a3a", "#6b4a2f"]) };
  }

  /* ---------- create a character ---------- */
  function create(tr) {
    var src = SRC[tr.sex === "F" ? "F" : "M"], ri = REG[tr.sex === "F" ? "F" : "M"];
    var root = T.SkeletonUtils.clone(src.scene), body = null, extras = [];
    root.traverse(function (o) { if (o.isSkinnedMesh) { o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; if (o.geometry === ri.body.geometry) body = o; else extras.push(o); } });
    /* skin */
    var dark = tr.skin >= 3, st = TEX[(tr.sex === "F" ? "female_" : "male_") + (dark ? "dark" : "light")];
    var bm = body.material.clone(); if (st) bm.map = st; bm.color = col(SKIN[tr.skin]).lerp(col("#ffffff"), dark ? 0.35 : 0.55); bm.roughness = 0.62; bm.metalnessMap = null; body.material = bm;
    extras.forEach(function (o) { if (/Eye/i.test(o.material.name)) { o.material = o.material.clone(); o.material.color = col(tr.eye || "#ffffff").lerp(col("#ffffff"), 0.4); } else if (/Hair/i.test(o.material.name)) { o.material = o.material.clone(); o.material.map = TEX.hair1; o.material.color = col(tr.hairColor); } });
    var skel = body.skeleton, parent = body.parent;
    /* clothes */
    var c1 = col(tr.c1), c2 = col(tr.c2), c3 = col(tr.c3), dk = function (c, k) { return c.clone().multiplyScalar(k); };
    var topRegs = tr.top === "tshirt" || tr.top === "polo" ? [1, 2, 4] : [1, 2, 3, 4];
    var y0 = ri.minY, H = ri.maxY - ri.minY, U = H / 1.8, fy = function (y) { return (y - y0) / H; };
    var topCol = function (x, y, z, rg, nx, ny, nz) {
      x /= U; z /= U; var front = z > 0.02, ax = Math.abs(x), h = fy(y);
      if (tr.top === "suit" || tr.top === "blazer") { return tr.top === "suit" ? dk(c3, 0.9) : c1; }
      if (tr.top === "jacket") { if (front && rg === 1 && ax < 0.05) return col("#e9e7e2"); return c1; }
      if (tr.top === "shirt") { if (front && rg === 1 && ax < 0.006) return dk(c1, 0.8); return c1; }
      if (tr.top === "hoodie") { if (front && rg === 1 && h < 0.66 && h > 0.6 && ax < 0.09) return dk(c1, 0.85); return c1; }
      if (tr.top === "polo") { if (front && rg === 1 && h > 0.78 && ax < 0.012) return dk(c1, 0.8); return c1; }
      return c1;
    };
    var botRegs = tr.bottom === "shorts" ? [4, 5] : [4, 5, 6];
    var botCol = function (x, y, z, rg) { var h = fy(y); if (rg === 4 && h > 0.56) return col("#1a1a1a"); var b = tr.bottom === "jeans" ? col(tr.c3).lerp(col("#2f4f7a"), 0.6) : tr.bottom === "chinos" ? col("#c9b48e").lerp(c3, 0.25) : c3; return b; };
    var shoeCol = function (x, y, z) { return fy(y) < 0.012 ? col("#f0eee8") : col(tr.shoes); };
    var mk = function (kind, rough) { return new T.MeshStandardMaterial({ map: fabric(kind), vertexColors: true, roughness: rough, metalness: 0, side: T.FrontSide, skinning: true }); };
    var topT = tr.top === "suit" || tr.top === "blazer" ? "suit" : tr.top === "jacket" ? "leather" : "knit";
    var parts = [
      shell(body, ri, botRegs, function (v, rg) { return (rg === 4 ? 0.012 : 0.009) * U; }, botCol, mk(tr.bottom === "jeans" ? "denim" : "suit", 0.9)),
      shell(body, ri, topRegs, function (v, rg) { if (rg === 4) return 0.018 * U; return (tr.top === "jacket" || tr.top === "suit" || tr.top === "blazer" || tr.top === "hoodie" ? (rg === 3 ? 0.014 : 0.02) : 0.011) * U; }, topCol, mk(topT, tr.top === "jacket" ? 0.55 : 0.88), function (y, rg) { return rg !== 4 || fy(y) > 0.545; }),
      shell(body, ri, [7], 0.016 * U, shoeCol, mk("leather", 0.5))
    ];
    parts.forEach(function (p) { parent.add(p); });
    /* hair */
    function addHair(name, color) {
      var h = HAIR[name]; if (!h) return null;
      var bones = h.skeleton.bones.map(function (b) { return skel.getBoneByName(b.name) || skel.bones[0]; });
      var m = new T.SkinnedMesh(h.geometry, h.material.clone()); var is2 = /Hair_2/.test(h.material.name);
      m.material.map = is2 ? TEX.hair2 : TEX.hair1; m.material.normalMap = is2 ? TEX.hair2_n : TEX.hair1_n; m.material.color = col(color); m.material.side = T.DoubleSide; m.material.alphaTest = 0.4; m.material.skinning = true; m.material.roughness = 0.7;
      m.bind(new T.Skeleton(bones, h.skeleton.boneInverses), body.bindMatrix); m.castShadow = true; m.frustumCulled = false; parent.add(m); return m;
    }
    extras.forEach(function (o) { if (/Eyebrows|Face$/i.test(o.name) && /Hair/i.test(o.material.name)) o.visible = false; });
    addHair(tr.hair, tr.hairColor); addHair(tr.sex === "F" ? "Eyebrows_Female" : "Eyebrows_Regular", tr.hairColor);
    if (tr.beard) addHair("Hair_Beard", tr.hairColor);
    var holder = new T.Group(); holder.add(root);
    var mixer = new T.AnimationMixer(root), acts = {}, cur = null;
    function act(name) { if (!acts[name] && CLIPS[name]) acts[name] = mixer.clipAction(CLIPS[name]); return acts[name]; }
    var bones = {}; skel.bones.forEach(function (b) { bones[b.name] = b; });
    var actor = {
      g: holder, root: root, mixer: mixer, bones: bones, traits: tr, cur: null,
      play: function (name, o) {
        o = o || {}; var a = act(name); if (!a) return;
        if (cur === a && !o.restart) { if (o.speed) a.timeScale = o.speed; return; }
        a.reset(); a.enabled = true; a.setEffectiveWeight(1); a.timeScale = o.speed || 1;
        if (o.once) { a.setLoop(T.LoopOnce, 1); a.clampWhenFinished = true; } else a.setLoop(T.LoopRepeat, Infinity);
        a.play(); if (cur && cur !== a) cur.crossFadeTo(a, o.fade !== undefined ? o.fade : 0.25, false); cur = a; actor.cur = name;
      },
      speed: function (s) { if (cur) cur.timeScale = s; },
      update: function (dt) { mixer.update(dt); },
      hand: function () { return bones.hand_r; }
    };
    actor.play("Idle");
    return actor;
  }

  /* ---------- passport photo rendered from the 3D character ---------- */
  function portrait(renderer, tr, w, h) {
    w = w || 300; h = h || 380;
    var sc = new T.Scene(); sc.background = new T.Color("#dfe7ee");
    var a = create(tr); a.play("Idle"); a.mixer.update(0.6); sc.add(a.g);
    sc.add(new T.HemisphereLight(0xffffff, 0x8a8a90, 0.9)); var k = new T.DirectionalLight(0xffffff, 1.1); k.position.set(0.6, 2.2, 2.4); sc.add(k); var f = new T.DirectionalLight(0xffffff, 0.45); f.position.set(-1.5, 1.6, 1.2); sc.add(f);
    a.g.updateMatrixWorld(true);
    var head = a.bones.Head, hp = new T.Vector3(); head.getWorldPosition(hp);
    var cam = new T.PerspectiveCamera(22, w / h, 0.05, 20); cam.position.set(hp.x, hp.y + 0.02, hp.z + 1.25); cam.lookAt(hp.x, hp.y - 0.05, hp.z);
    var rt = new T.WebGLRenderTarget(w, h, { encoding: T.sRGBEncoding }); var prev = renderer.getRenderTarget(), pe = renderer.outputEncoding;
    renderer.setRenderTarget(rt); renderer.render(sc, cam);
    var px = new Uint8Array(w * h * 4); renderer.readRenderTargetPixels(rt, 0, 0, w, h, px); renderer.setRenderTarget(prev);
    var c = document.createElement("canvas"); c.width = w; c.height = h; var g = c.getContext("2d"), id = g.createImageData(w, h);
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) { var s = ((h - 1 - y) * w + x) * 4, d = (y * w + x) * 4; id.data[d] = px[s]; id.data[d + 1] = px[s + 1]; id.data[d + 2] = px[s + 2]; id.data[d + 3] = 255; }
    g.putImageData(id, 0, 0); rt.dispose();
    return c.toDataURL("image/jpeg", 0.9);
  }
  window.People = { load: load, create: create, traitsFor: traitsFor, portrait: portrait, clips: CLIPS, SKIN: SKIN };
})();
