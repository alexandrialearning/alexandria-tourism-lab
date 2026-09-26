function U(n, s, t) {
  return n + (s - n) * t;
}
function nt(n) {
  return n - Math.floor(n);
}
function G(n, s) {
  const t = Math.floor(n), r = Math.floor(s);
  let e = n - t, o = s - r;
  e = e * e * (3 - 2 * e), o = o * o * (3 - 2 * o);
  const c = E(t, r), M = E(t + 1, r), h = E(t, r + 1), m = E(t + 1, r + 1);
  return c + (M - c) * e + (h - c) * o + (c - M - h + m) * e * o;
}
function E(n, s) {
  const t = Math.sin(n * 12.9898 + s * 78.233) * 43758.5453;
  return t - Math.floor(t);
}
function J(n, s) {
  const t = Math.PI * (3 - Math.sqrt(5)), r = 1 - 2 * (n + 0.5) / s, e = Math.sqrt(1 - r * r), o = n * t;
  return [e * Math.cos(o), r, e * Math.sin(o)];
}
function at(n, s) {
  return Math.atan2(Math.sin(n - s), Math.cos(n - s));
}
function _(n, s, t, r, e) {
  const o = Math.sin(s), c = Math.cos(s), M = Math.sin(n), h = Math.cos(n);
  return (m, R, p) => {
    const a = m * h + p * M, l = -m * M + p * h, P = R * c - l * o, w = R * o + l * c;
    return [t + a * e, r - P * e, w];
  };
}
function rt(n, s, t, r = 0.3) {
  for (const e of s) {
    const o = e.a ?? 1, c = Math.min(1, Math.max(0, e.white)), M = Math.round((t ? 1 - c : c) * 255);
    n.fillStyle = `rgba(${M},${M},${M},${o})`, n.beginPath(), n.arc(e.x, e.y, e.r, 0, Math.PI * 2), n.fill();
  }
}
function it(n, s, t) {
  for (const r of s) {
    const e = r.a ?? 1, o = Math.min(1, Math.max(0, r.white)), c = Math.round((t ? 1 - o : o) * 255);
    n.strokeStyle = `rgba(${c},${c},${c},${e})`, n.lineWidth = r.w, n.beginPath(), n.moveTo(r.x1, r.y1), n.lineTo(r.x2, r.y2), n.stroke();
  }
}
function L(n, s, t = 0.3) {
  const r = [];
  for (const e of n)
    (e.a ?? 1) < 0.02 || (e.r = Math.max(t, e.r), r.push(e));
  return r.sort((e, o) => e.z - o.z), { dots: r, lines: s.filter((e) => (e.a ?? 1) >= 0.02) };
}
function ht(n, s, t) {
  s.lines.length && it(n, s.lines, t), rt(n, s.dots, t);
}
function $(n, s) {
  return (n / 300) ** s;
}
const Mt = (n, s, t) => {
  const r = n / 2, e = n / 2, o = n / 2 * 0.76, c = _(s * 0.4, 0.3, r, e, 1), M = $(n, t.rsPow ?? 0.6), h = [], m = t.ghostN ?? 150;
  for (let a = 0; a < m; a++) {
    const l = J(a, m), [P, w, i] = c(l[0] * o, l[1] * o, l[2] * o), u = (i / o + 1) / 2;
    h.push({ x: P, y: w, z: i, r: 0.8 * M, white: 0.78, a: 0.1 + 0.22 * u });
  }
  const R = t.strandN ?? 52, p = t.turns ?? 3;
  for (let a = 0; a < 3; a++) {
    const l = a / 3 * 2 * Math.PI;
    for (let P = 0; P < R; P++) {
      const w = (nt(P / R + s * 0.045) * 2 - 1) * 0.96, i = Math.sqrt(Math.max(0, 1 - w * w)), u = Math.min(1, (1 - Math.abs(w)) / 0.1), y = w * Math.PI * p + l, b = 1 + 0.075 * Math.sin(w * Math.PI * p * 2 + l * 2 + s * 0.8), d = i * o * b, [z, x, g] = c(Math.cos(y) * d, w * o * b, Math.sin(y) * d), f = (g / o + 1) / 2;
      h.push({
        x: z,
        y: x,
        z: g,
        r: ((t.rBase ?? 1.2) + (t.rDepth ?? 1.8) * f) * M,
        white: 0.55 - 0.45 * f,
        a: u * (0.45 + 0.55 * f)
      });
    }
  }
  return L(h, [], t.rMin);
};
function lt(n, s, t, r) {
  const e = 2 * s * t + r, o = n % e, c = new Array(s).fill(0);
  let M = -1;
  if (o < 2 * s * t) {
    const h = Math.floor(o / t), m = (o - h * t) / t, p = 1 - (1 - Math.min(1, m / 0.7)) ** 3;
    if (h < s) {
      for (let a = 0; a < h; a++) c[a] = 1;
      c[h] = p, M = h;
    } else {
      const a = 2 * s - 1 - h;
      for (let l = 0; l < a; l++) c[l] = 1;
      c[a] = 1 - p, M = a;
    }
  }
  return { amount: c, active: M };
}
function pt(n, s, t) {
  let [r, e, o] = n, c = !1;
  for (let M = 0; M < s.length; M++) {
    if (t.amount[M] <= 0) continue;
    const h = s[M], m = h.axis === 0 ? r : h.axis === 1 ? e : o;
    if (m < h.lo || m >= h.hi) continue;
    M === t.active && (c = !0);
    const R = h.ang * t.amount[M], p = Math.cos(R), a = Math.sin(R);
    if (h.axis === 0) {
      const l = e * p - o * a;
      o = e * a + o * p, e = l;
    } else if (h.axis === 1) {
      const l = r * p + o * a;
      o = -r * a + o * p, r = l;
    } else {
      const l = r * p - e * a;
      e = r * a + e * p, r = l;
    }
  }
  return [r, e, o, c];
}
function ut(n) {
  const s = [];
  for (let t = 0; t < n; t++) {
    const r = Math.min(2, Math.floor(E(t, 2.3) * 3)), e = -1 + 0.5 * Math.min(3, Math.floor(E(t, 5.9) * 4)), o = E(t, 7.7) < 0.5 ? 1 : -1;
    s.push({ axis: r, lo: e, hi: e + 0.5, ang: o * Math.PI / 2 });
  }
  return s;
}
const dt = (n, s, t) => {
  const e = n / 2, o = n / 2, c = n / 2 * 0.82, M = 0.4 + 0.06 * Math.sin(s * 0.35), h = _(s * 0.5, M, e, o, c), m = s * (0.5 + (1.7 - 0.5) * (t.scanMul ?? 1)), R = $(n, t.rsPow ?? 0.6), p = t.dimBase ?? 1, a = [], l = t.latRings ?? 17, P = t.lonDensity ?? 44;
  for (let w = 0; w <= l; w++) {
    const i = -Math.PI / 2 + w / l * Math.PI, u = Math.cos(i), y = Math.sin(i), b = Math.max(1, Math.round(Math.abs(u) * P));
    for (let d = 0; d < b; d++) {
      const z = d / b * 2 * Math.PI, [x, g, f] = h(u * Math.cos(z), y, u * Math.sin(z)), D = (f + 1) / 2, k = at(z + s * 0.5, m), N = Math.exp(-(k * k) / 0.18) * Math.max(0, f);
      a.push({
        x,
        y: g,
        z: f,
        r: ((t.rBase ?? 0.6) + (t.rDepth ?? 1.7) * D + (t.rBoost ?? 1) * N) * R,
        white: (t.inkFar ?? 0.62) - (t.inkSpan ?? 0.54) * D,
        // dimBase < 1 fades un-scanned dots so the meridian reads clearly
        a: p + (1 - p) * Math.min(1, N)
      });
    }
  }
  return L(a, [], t.rMin);
}, ft = (n, s, t) => {
  const r = n / 2, e = n / 2, o = n / 2 * 0.82, c = _(s * 0.55, 0.35 + 0.1 * Math.sin(s * 0.9), r, e, o), M = $(n, t.rsPow ?? 0.6), h = t.moveCount ?? 14, m = ut(h), R = lt(s, h, 0.42, 1.2), p = [], a = t.latRings ?? 15, l = t.lonDensity ?? 40;
  for (let P = 0; P <= a; P++) {
    const w = -Math.PI / 2 + P / a * Math.PI, i = Math.cos(w), u = Math.sin(w), y = Math.max(1, Math.round(Math.abs(i) * l));
    for (let b = 0; b < y; b++) {
      const d = b / y * 2 * Math.PI, [z, x, g, f] = pt([i * Math.cos(d), u, i * Math.sin(d)], m, R), [D, k, N] = c(z, x, g), v = (N + 1) / 2;
      p.push({
        x: D,
        y: k,
        z: N,
        r: ((t.rBase ?? 0.6) + (t.rDepth ?? 1.7) * v + (f ? t.rActive ?? 0.3 : 0)) * M,
        white: (t.inkFar ?? 0.62) - (t.inkSpan ?? 0.54) * v - (f ? 0.14 : 0)
      });
    }
  }
  return L(p, [], t.rMin);
}, bt = (n, s, t) => {
  const r = n / 2, e = n / 2, o = n / 2 * 0.874, c = _(s * 0.18, 0.38, r, e, 1), M = $(n, t.rsPow ?? 0.6), h = [], m = t.rings ?? 15, R = t.lonDensity ?? 40;
  for (let p = 0; p <= m; p++) {
    const a = -Math.PI / 2 + p / m * Math.PI, l = Math.cos(a), P = Math.sin(a), w = 0.62 * Math.sin(s * 2.1 - p * 0.52) + 0.38 * Math.sin(s * 1.27 + p * 0.83), i = o * (0.88 + 0.105 * w), u = Math.max(1, Math.round(Math.abs(l) * R));
    for (let y = 0; y < u; y++) {
      const b = y / u * 2 * Math.PI, [d, z, x] = c(l * Math.cos(b) * i, P * i, l * Math.sin(b) * i), g = (x / o + 1) / 2, f = Math.max(0, w);
      h.push({
        x: d,
        y: z,
        z: x,
        r: ((t.rBase ?? 0.6) + (t.rDepth ?? 1.7) * g) * (1 + 0.4 * f) * M,
        white: 0.66 - 0.56 * g - 0.1 * f
      });
    }
  }
  return L(h, [], t.rMin);
};
function xt(n) {
  return n * n * (3 - 2 * n);
}
function st(n) {
  const s = n.length, t = [];
  let r = 0;
  for (let e = 0; e < s; e++) {
    const o = n[e], c = n[(e + 1) % s], M = Math.hypot(c[0] - o[0], c[1] - o[1]);
    t.push(M), r += M;
  }
  return (e) => {
    let o = e * r, c = 0;
    for (; o > t[c] && c < s - 1; )
      o -= t[c], c++;
    const M = n[c], h = n[(c + 1) % s], m = t[c] ? Math.min(1, o / t[c]) : 0;
    return [M[0] + (h[0] - M[0]) * m, M[1] + (h[1] - M[1]) * m];
  };
}
const yt = (n) => {
  const s = -Math.PI / 2 + n * 2 * Math.PI;
  return [Math.cos(s) * 0.24, Math.sin(s) * 0.24];
}, gt = st([
  [0, -0.26],
  [0.24, 0.16],
  [-0.24, 0.16]
]), mt = st([
  [0, -0.2],
  [0.2, -0.2],
  [0.2, 0.2],
  [-0.2, 0.2],
  [-0.2, -0.2]
]), H = [yt, gt, mt];
function wt(n) {
  return Math.max(6, Math.round(34 * n));
}
const V = 1.4, ot = 0.9, Q = V + ot, zt = (n, s, t) => {
  const r = H.length, e = s % (Q * r), o = Math.floor(e / Q), c = e - o * Q, M = c > V ? xt((c - V) / ot) : 0, h = t.spread ?? 1, m = H[o], R = H[(o + 1) % r], p = 160, a = [];
  for (let x = 0; x < p; x++) {
    const g = x / p, f = m(g), D = R(g);
    a.push([(f[0] + (D[0] - f[0]) * M) * h, (f[1] + (D[1] - f[1]) * M) * h]);
  }
  const l = [];
  let P = 0;
  for (let x = 0; x < p; x++) {
    const g = a[x], f = a[(x + 1) % p], D = Math.hypot(f[0] - g[0], f[1] - g[1]);
    l.push(D), P += D;
  }
  const w = wt(t.iconD ?? 1), i = (t.rDot ?? 0.021) * 1.35 * h, u = 1 + 0.02 * Math.sin(c * 3.1), y = [], b = n / 2;
  let d = 0, z = 0;
  for (let x = 0; x < w; x++) {
    const g = x / w * P;
    for (; z + l[d] < g && d < p - 1; )
      z += l[d], d++;
    const f = a[d], D = a[(d + 1) % p], k = l[d] ? Math.min(1, (g - z) / l[d]) : 0, N = (f[0] + (D[0] - f[0]) * k) * u, v = (f[1] + (D[1] - f[1]) * k) * u;
    y.push({
      x: b + N * n,
      y: b + v * n,
      z: 0,
      r: Math.max(0.35, i * n),
      white: 0.1
    });
  }
  return L(y, [], t.rMin);
}, Pt = (n, s, t) => {
  const r = n / 2, e = n / 2, o = n / 2 * 0.82, c = _(s * 0.12, 0.3, r, e, 1), M = $(n, t.rsPow ?? 0.6), h = [], m = t.orbitN ?? 12, R = t.ghostN ?? 40, p = t.particles ?? 3;
  for (let a = 0; a < m; a++) {
    const l = E(a, 1.7), P = E(a, 5.2), w = E(a, 8.9), i = o * (0.45 + 0.52 * l), u = l * 2 * Math.PI, y = Math.acos(2 * P - 1), b = Math.sin(y) * Math.cos(u), d = Math.cos(y), z = Math.sin(y) * Math.sin(u);
    let x = -d, g = b;
    const f = 0, D = Math.max(1e-6, Math.sqrt(x * x + g * g));
    x /= D, g /= D;
    const k = d * f - z * g, N = z * x - b * f, v = b * g - d * x, O = (0.25 + 0.55 * w) * (w > 0.5 ? 1 : -1);
    for (let B = 0; B < R; B++) {
      const I = B / R * 2 * Math.PI, [S, A, T] = c(
        (x * Math.cos(I) + k * Math.sin(I)) * i,
        (g * Math.cos(I) + N * Math.sin(I)) * i,
        (f * Math.cos(I) + v * Math.sin(I)) * i
      ), C = (T / i + 1) / 2;
      h.push({
        x: S,
        y: A,
        z: T,
        r: (t.ghostR ?? 0.9) * M,
        white: 0.72,
        a: (t.ghostA ?? 0.5) * (0.4 + 0.6 * C)
      });
    }
    for (let B = 0; B < p; B++) {
      const I = s * O + B / p * 2 * Math.PI + P * 6, [S, A, T] = c(
        (x * Math.cos(I) + k * Math.sin(I)) * i,
        (g * Math.cos(I) + N * Math.sin(I)) * i,
        (f * Math.cos(I) + v * Math.sin(I)) * i
      ), C = (T / i + 1) / 2;
      h.push({
        x: S,
        y: A,
        z: T,
        r: ((t.partR ?? 1.2) + (t.partRDepth ?? 1.6) * C) * M,
        white: 0.3 - 0.22 * C
      });
    }
  }
  return L(h, [], t.rMin);
}, Z = (n, s, t) => {
  const r = n / 2, e = n / 2, o = n / 2 * 0.78, c = t.spin ?? 1, M = 0.3, h = _(s * 0.1 * c, M, r, e, 1), m = $(n, t.rsPow ?? 0.6), R = [], p = t.ghostN ?? 150;
  for (let v = 0; v < p; v++) {
    const O = J(v, p), [B, I, S] = h(O[0] * o, O[1] * o, O[2] * o), A = (S / o + 1) / 2;
    R.push({ x: B, y: I, z: S, r: 0.8 * m, white: 0.78, a: 0.1 + 0.22 * A });
  }
  const a = s * 0.24 * c, l = t.faceOn ? -M : 0.55 + 0.3 * Math.sin(s * 0.18) * c, P = Math.cos(a), w = 0, i = Math.sin(a), u = -i * Math.sin(l), y = Math.cos(l), b = P * Math.sin(l), d = w * b - i * y, z = i * u - P * b, x = P * y - w * u, g = 0.23 * (t.wobMul ?? 1), f = t.faceOn ? o / (1 + 0.85 * g) : o, D = t.lanes ?? 5, k = t.segs ?? 88, N = Math.max(1, Math.round(D * (t.bandMul ?? 1)));
  for (let v = 0; v < N; v++) {
    const O = (v - (N - 1) / 2) * 0.075, B = Math.abs(v - (N - 1) / 2) / Math.max(1, (N - 1) / 2);
    for (let I = 0; I < k; I++) {
      const S = I / k * 2 * Math.PI, A = (0.16 * Math.sin(S * 3 - s * 1.7 + v * 0.22) + 0.07 * Math.sin(S * 5 + s * 1.1)) * (t.wobMul ?? 1), T = t.faceOn ? 1 + A : 1, C = t.faceOn ? O : O + A, q = P * Math.cos(S) + u * Math.sin(S) + d * C, F = w * Math.cos(S) + y * Math.sin(S) + z * C, j = i * Math.cos(S) + b * Math.sin(S) + x * C, W = Math.sqrt(q * q + F * F + j * j), Y = f * T, [ct, et, X] = h(q / W * Y, F / W * Y, j / W * Y), K = (X / o + 1) / 2;
      R.push({
        x: ct,
        y: et,
        z: X,
        r: ((t.rBase ?? 1.1) + (t.rDepth ?? 1.7) * K) * (1 - 0.25 * B) * m,
        white: 0.52 - 0.44 * K + 0.18 * B,
        a: 0.4 + 0.6 * K
      });
    }
  }
  return L(R, [], t.rMin);
}, Rt = (n, s, t) => {
  const r = n / 2, e = n / 2, o = n / 2 * 0.8 * (t.spread ?? 1), c = _(s * 0.12, 0.32, r, e, o), M = $(n, t.rsPow ?? 0.6), h = t.nodeN ?? 30, m = t.thr ?? 0.72, R = t.nodeR ?? 1.4, p = t.nodeRDepth ?? 1.8, a = [];
  for (let i = 0; i < h; i++) {
    const u = J(i, h), y = u[0] + 0.3 * (G(i * 0.31 + 9, s * 0.24) - 0.5) * 2, b = u[1] + 0.3 * (G(i * 0.53 + 27, s * 0.21) - 0.5) * 2, d = u[2] + 0.3 * (G(i * 0.77 + 55, s * 0.27) - 0.5) * 2, z = Math.sqrt(y * y + b * b + d * d);
    a.push([y / z, b / z, d / z]);
  }
  const l = [], P = [];
  for (let i = 0; i < h; i++)
    for (let u = i + 1; u < h; u++) {
      const y = a[i][0] - a[u][0], b = a[i][1] - a[u][1], d = a[i][2] - a[u][2], z = Math.sqrt(y * y + b * b + d * d);
      if (z >= m) continue;
      const [x, g, f] = c(a[i][0], a[i][1], a[i][2]), [D, k, N] = c(a[u][0], a[u][1], a[u][2]), v = ((f + N) / 2 + 1) / 2;
      l.push({
        x1: x,
        y1: g,
        x2: D,
        y2: k,
        white: 0.42,
        a: (1 - z / m) * (0.3 + 0.55 * v),
        w: Math.max(0.6, (t.lineW ?? 0.8) * M)
      });
    }
  for (let i = 0; i < h; i++) {
    const [u, y, b] = c(a[i][0], a[i][1], a[i][2]), d = (b + 1) / 2, z = 1 + 0.25 * Math.sin(s * 1.4 + i * 2.7);
    P.push({
      x: u,
      y,
      z: b,
      r: (R + p * d) * z * M,
      white: 0.55 - 0.45 * d
    });
  }
  const w = t.signals ?? 5;
  for (let i = 0; i < w; i++) {
    const u = Math.floor(s * 0.55 + i * 7.31), y = Math.floor(E(u, i * 3.1 + 1.7) * h), b = Math.floor(E(u, i * 5.7 + 4.2) * h);
    if (y === b) continue;
    const d = nt(s * 0.55 + i * 7.31), z = U(a[y][0], a[b][0], d), x = U(a[y][1], a[b][1], d), g = U(a[y][2], a[b][2], d), f = Math.max(1e-6, Math.sqrt(z * z + x * x + g * g)), [D, k, N] = c(z / f, x / f, g / f), v = (N + 1) / 2;
    P.push({
      x: D,
      y: k,
      z: N,
      r: (R * 1.5 + p * v) * M,
      white: 0.05,
      a: 0.5 + 0.5 * v
    });
  }
  return L(P, l, t.rMin);
}, Dt = {
  orbits: Pt,
  globe: dt,
  rubik: ft,
  wave: bt,
  web: Rt,
  braid: Mt,
  ribbon: Z,
  // ring shares ribbon's geometry — the `faceOn` profile flag switches it
  ring: Z,
  morph: zt
}, Ct = Object.fromEntries(
  Object.entries(Dt).map(([n, s]) => [
    n,
    (t, r, e, o, c) => ht(t, s(r, e, c), o)
  ])
), vt = [
  ["latRings", "lonDensity"],
  ["rings", "lonDensity"],
  ["lanes", "segs"]
], Nt = ["orbitN", "ghostN", "nodeN", "strandN", "signals"], It = ["iconD"], kt = [
  "rBase",
  "rDepth",
  "rActive",
  "rDot",
  "ghostR",
  "partR",
  "partRDepth",
  "nodeR",
  "nodeRDepth"
];
function St(n, s) {
  const t = { ...n }, r = /* @__PURE__ */ new Set(), e = Math.sqrt(s);
  for (const [o, c] of vt) {
    const M = t[o], h = t[c];
    M != null && h != null && !r.has(o) && !r.has(c) && (t[o] = Math.max(2, Math.round(M * e)), t[c] = Math.max(2, Math.round(h * e)), r.add(o), r.add(c));
  }
  for (const o of Nt) {
    const c = t[o];
    c != null && c !== 0 && !r.has(o) && (t[o] = Math.max(1, Math.round(c * s)));
  }
  for (const o of It) {
    const c = t[o];
    c != null && (t[o] = Math.max(0.02, c * s));
  }
  return t;
}
function Bt(n, s) {
  const t = { ...n };
  for (const r of kt) {
    const e = t[r];
    e != null && (t[r] = e * s);
  }
  return t.rSizeMul = (t.rSizeMul ?? 1) * s, t;
}
const Et = {
  globe: {
    latRings: 17,
    lonDensity: 44,
    rBase: 0.6,
    rDepth: 1.7,
    rBoost: 1,
    inkFar: 0.62,
    inkSpan: 0.54,
    rsPow: 0.6,
    rMin: 0.3
  },
  orbits: {
    orbitN: 12,
    ghostN: 40,
    ghostR: 0.9,
    ghostA: 0.5,
    particles: 3,
    partR: 1.2,
    partRDepth: 1.6,
    rsPow: 0.6,
    rMin: 0.3
  },
  rubik: {
    latRings: 15,
    lonDensity: 40,
    moveCount: 14,
    rBase: 0.6,
    rDepth: 1.7,
    rActive: 0.3,
    inkFar: 0.62,
    inkSpan: 0.54,
    rsPow: 0.6,
    rMin: 0.3
  },
  wave: {
    rings: 15,
    lonDensity: 40,
    rBase: 0.6,
    rDepth: 1.7,
    rsPow: 0.6,
    rMin: 0.3
  },
  web: {
    nodeN: 30,
    thr: 0.72,
    signals: 5,
    nodeR: 1.4,
    nodeRDepth: 1.8,
    lineW: 0.8,
    rsPow: 0.6,
    rMin: 0.3
  },
  braid: {
    strandN: 52,
    turns: 3,
    ghostN: 150,
    rBase: 1.2,
    rDepth: 1.8,
    rsPow: 0.6,
    rMin: 0.3
  },
  ribbon: {
    lanes: 5,
    segs: 88,
    ghostN: 150,
    rBase: 1.1,
    rDepth: 1.7,
    rsPow: 0.6,
    rMin: 0.3
  },
  // ring shares ribbon's painter; faceOn cancels the camera tilt and moves
  // the undulation onto the radius, and there is no ghost sphere behind it
  ring: {
    lanes: 5,
    segs: 88,
    ghostN: 0,
    faceOn: 1,
    rBase: 1.1,
    rDepth: 1.7,
    rsPow: 0.6,
    rMin: 0.3
  },
  morph: {
    rDot: 0.021,
    iconD: 1,
    rMin: 0.25
  }
}, Ot = {
  working: "orbits",
  searching: "globe",
  solving: "rubik",
  listening: "wave",
  connecting: "web",
  weaving: "braid",
  composing: "ribbon",
  breathing: "ring",
  shaping: "morph"
}, At = {
  orbits: {
    64: { speed: 1.885, count: 1, size: 1 },
    256: { speed: 1.885, count: 1, size: 1 },
    512: { speed: 1.885, count: 1, size: 1 },
    20: { speed: 3.9, count: 0.238, size: 2.4 }
  },
  globe: {
    64: { speed: 2.015, count: 0.42, size: 1.15, extra: { scanMul: 4.08, dimBase: 0.45 } },
    256: { speed: 2.015, count: 0.42, size: 1.15, extra: { scanMul: 4.08, dimBase: 0.45 } },
    512: { speed: 2.015, count: 0.42, size: 1.15, extra: { scanMul: 4.08, dimBase: 0.45 } },
    20: { speed: 2.665, count: 0.105, size: 1.75, extra: { scanMul: 4.335, dimBase: 0.45 } }
  },
  rubik: {
    64: { speed: 1.82, count: 0.35, size: 1.05 },
    256: { speed: 1.82, count: 0.35, size: 1.05 },
    512: { speed: 1.82, count: 0.35, size: 1.05 },
    20: { speed: 1.95, count: 0.088, size: 1.9 }
  },
  wave: {
    64: { speed: 4.388, count: 0.341, size: 1 },
    256: { speed: 4.388, count: 0.341, size: 1 },
    512: { speed: 4.388, count: 0.341, size: 1 },
    20: { speed: 3.998, count: 0.105, size: 1.6 }
  },
  web: {
    64: { speed: 3.315, count: 1.35, size: 0.95 },
    256: { speed: 3.315, count: 1.35, size: 0.95 },
    512: { speed: 3.315, count: 1.35, size: 0.95 },
    20: { speed: 6.63, count: 0.25, size: 1.52 }
  },
  braid: {
    64: { speed: 1.625, count: 0.5, size: 1 },
    256: { speed: 1.625, count: 0.5, size: 1 },
    512: { speed: 1.625, count: 0.5, size: 1 },
    20: { speed: 2.75, count: 0.1125, size: 1.36 }
  },
  ribbon: {
    64: { speed: 2.34, count: 0.25, size: 0.85, extra: { spin: 0, bandMul: 3.9, wobMul: 1 } },
    256: { speed: 2.34, count: 0.25, size: 0.85, extra: { spin: 0, bandMul: 3.9, wobMul: 1 } },
    512: { speed: 2.34, count: 0.25, size: 0.85, extra: { spin: 0, bandMul: 3.9, wobMul: 1 } },
    20: { speed: 3.12, count: 0.051, size: 1.073, extra: { spin: 0, bandMul: 4.94, wobMul: 1 } }
  },
  ring: {
    64: { speed: 3.24, count: 0.25, size: 0.956, extra: { spin: 0, bandMul: 3.627, wobMul: 0.368 } },
    256: { speed: 3.24, count: 0.25, size: 0.956, extra: { spin: 0, bandMul: 3.627, wobMul: 0.368 } },
    512: { speed: 3.24, count: 0.25, size: 0.956, extra: { spin: 0, bandMul: 3.627, wobMul: 0.368 } },
    20: { speed: 3.78, count: 0.028, size: 1.622, extra: { spin: 0, bandMul: 3.968, wobMul: 0.565 } }
  },
  morph: {
    64: { speed: 2.405, count: 0.702, size: 0.395, extra: { spread: 1.45 } },
    256: { speed: 2.405, count: 0.702, size: 0.395, extra: { spread: 1.45 } },
    512: { speed: 2.405, count: 0.702, size: 0.395, extra: { spread: 1.45 } },
    20: { speed: 2.08, count: 0.53, size: 1.011, extra: { spread: 1.45 } }
  }
}, tt = /* @__PURE__ */ new Map();
function Lt(n, s) {
  const t = `${n}-${s}`, r = tt.get(t);
  if (r) return r;
  const e = Ot[n], o = At[e][s];
  let c = { ...Et[e] };
  o.count !== 1 && (c = St(c, o.count)), o.size !== 1 && (c = Bt(c, o.size)), o.extra && (c = { ...c, ...o.extra });
  const M = { mode: e, speed: o.speed, opts: c };
  return tt.set(t, M), M;
}
export {
  Ct as MODE_DRAWS,
  Dt as MODE_FRAMES,
  Ot as STATE_TO_MODE,
  L as finalizeFrame,
  _ as makeProj,
  rt as paint,
  ht as paintFrame,
  it as paintLines,
  $ as radiusScale,
  Lt as resolvePreset
};
