export async function extractColors(e, t = 5) {
  const a = URL.createObjectURL(e);
  try {
    const r = await new Promise((f, p) => {
      const h = new Image();
      h.onload = () => f(h);
      h.onerror = p;
      h.src = a;
    });
    const o = 64;
    const i = document.createElement("canvas");
    i.width = o;
    i.height = o;
    const s = i.getContext("2d", {
      willReadFrequently: true,
    });
    s.drawImage(r, 0, 0, o, o);
    const l = s.getImageData(0, 0, o, o).data;
    const u = new Map();
    for (let f = 0; f < l.length; f += 4) {
      if (l[f + 3] < 200) {
        continue;
      }
      const p = l[f];
      const h = l[f + 1];
      const x = l[f + 2];
      const S = ((p >> 4) << 8) | ((h >> 4) << 4) | (x >> 4);
      const v = Math.max(p, h, x);
      const g = Math.min(p, h, x);
      const y = 1 + (v === 0 ? 0 : (v - g) / v) * 2.5;
      const L = u.get(S) || {
        w: 0,
        r: 0,
        g: 0,
        b: 0,
      };
      L.w += y;
      L.r += p * y;
      L.g += h * y;
      L.b += x * y;
      u.set(S, L);
    }
    const d = [...u.values()]
      .map((f) => [
        Math.round(f.r / f.w),
        Math.round(f.g / f.w),
        Math.round(f.b / f.w),
        f.w,
      ])
      .sort((f, p) => p[3] - f[3]);
    const c = [];
    for (const f of d) {
      if (
        c.every((p) => Math.hypot(p[0] - f[0], p[1] - f[1], p[2] - f[2]) > 64)
      ) {
        c.push(f);
      }
      if (c.length >= t) {
        break;
      }
    }
    return c.map(
      ([f, p, h]) =>
        "#" + [f, p, h].map((x) => x.toString(16).padStart(2, "0")).join(""),
    );
  } finally {
    URL.revokeObjectURL(a);
  }
}
