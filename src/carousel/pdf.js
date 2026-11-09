// A minimal PDF writer: one JPEG per page, nothing else. LinkedIn shows a
// PDF upload as a swipeable document carousel.

const enc = new TextEncoder();

export function makePdf(pages, { title = "Carousel" } = {}) {
  // pages: [{ jpeg: Uint8Array, width, height }] (pixel size of each JPEG)
  const chunks = [];
  const offsets = [];
  let length = 0;
  const push = (data) => {
    const bytes = typeof data === "string" ? enc.encode(data) : data;
    chunks.push(bytes);
    length += bytes.length;
  };
  const obj = (n, body) => {
    offsets[n] = length;
    push(`${n} 0 obj\n`);
    for (const part of body) push(part);
    push("\nendobj\n");
  };

  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  const count = pages.length;
  // Object numbers: 1 catalog, 2 pages, 3 info, then 3 per page (page, content, image).
  const pageNum = (i) => 4 + i * 3;
  const safeTitle = String(title).replace(/[()\\]/g, "").slice(0, 120);
  obj(1, ["<< /Type /Catalog /Pages 2 0 R >>"]);
  obj(2, [`<< /Type /Pages /Count ${count} /Kids [${pages.map((_, i) => `${pageNum(i)} 0 R`).join(" ")}] >>`]);
  obj(3, [`<< /Title (${safeTitle}) /Producer (Pipsqueak) >>`]);
  pages.forEach((p, i) => {
    // 2 pixels per point keeps pages a sensible physical size.
    const w = +(p.width / 2).toFixed(2);
    const h = +(p.height / 2).toFixed(2);
    const n = pageNum(i);
    const content = `q ${w} 0 0 ${h} 0 0 cm /Im${i} Do Q`;
    obj(n, [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im${i} ${n + 2} 0 R >> >> /Contents ${n + 1} 0 R >>`]);
    obj(n + 1, [`<< /Length ${content.length} >>\nstream\n${content}\nendstream`]);
    obj(n + 2, [
      `<< /Type /XObject /Subtype /Image /Width ${p.width} /Height ${p.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`,
      p.jpeg,
      "\nendstream",
    ]);
  });
  const xref = length;
  const total = 4 + count * 3;
  let table = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let n = 1; n < total; n++) table += `${String(offsets[n]).padStart(10, "0")} 00000 n \n`;
  push(table);
  push(`trailer\n<< /Size ${total} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const out = new Uint8Array(length);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}
