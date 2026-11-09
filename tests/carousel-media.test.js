import { beforeAll, describe, expect, it, vi } from "vitest";

// The Edge Function modules read Deno.env when they load.
let media;
beforeAll(async () => {
  globalThis.Deno = { env: { get: () => "" } };
  media = await import("../supabase/functions/carousel/media.ts");
});

describe("carousel image safety", () => {
  it("refuses private and local addresses", () => {
    for (const h of ["localhost", "127.0.0.1", "10.0.0.8", "192.168.1.1", "172.20.0.1", "169.254.169.254", "::1", "[fd00::1]", "metadata.internal", "2130706433", "0x7f000001", "intranet"]) {
      expect(media.isPrivateAddress(h), h).toBe(true);
    }
    for (const h of ["images.unsplash.com", "8.8.8.8", "upload.wikimedia.org"]) expect(media.isPrivateAddress(h), h).toBe(false);
  });

  it("recognises real image files and rejects everything else", () => {
    expect(media.sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))?.mime).toBe("image/jpeg");
    expect(media.sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d]))?.mime).toBe("image/png");
    expect(media.sniffImage(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))?.mime).toBe("image/webp");
    expect(media.sniffImage(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'>"))).toBeNull();
    expect(media.sniffImage(new TextEncoder().encode("<html>"))).toBeNull();
  });

  it("reads web image results, skipping watermarked, AI and small images", async () => {
    const item = (m, w, h) =>
      `<a class="iusc" style="" m="${JSON.stringify(m).replace(/"/g, "&quot;")}" href="/images/search?view=detailV2&amp;thid=OIP.${m.md5}&amp;expw=${w}&amp;exph=${h}&amp;q=x">`;
    const html = [
      item({ md5: "good", murl: "https://site.com/a.jpg", purl: "https://site.com/page", t: "A tea house" }, 2400, 1600),
      item({ md5: "stock", murl: "https://www.shutterstock.com/x.jpg", purl: "https://www.shutterstock.com/p", t: "Stock" }, 2400, 1600),
      item({ md5: "ai", murl: "https://lummi.ai/x.jpg", purl: "https://lummi.ai/p", t: "Nice" }, 2400, 1600),
      item({ md5: "aitld", murl: "https://cdn.feeldesign.ai/x.jpg", purl: "https://feeldesign.ai/p", t: "Nice" }, 2400, 1600),
      item({ md5: "small", murl: "https://site.com/s.jpg", purl: "https://site.com/s", t: "Small" }, 640, 480),
      item({ md5: "mock", murl: "https://site.com/m.jpg", purl: "https://site.com/m", t: "Laptop mockup template" }, 2400, 1600),
    ].join("");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(html, { status: 200 })));
    const out = await media.searchWeb("tea house");
    vi.unstubAllGlobals();
    expect(out.map((c) => c.id)).toEqual(["web:good"]);
    expect(out[0].original).toBe("https://site.com/a.jpg");
    expect(out[0].full).toContain("th.bing.com/th/id/OIP.good");
    expect(out[0].license).toMatch(/unknown/i);
  });
});
