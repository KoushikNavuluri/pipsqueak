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

  it("reads web image results, allowing HD screenshots and skipping watermarked, AI and small images", async () => {
    const item = (m, w, h) =>
      `<a class="iusc" style="" m="${JSON.stringify(m).replace(/"/g, "&quot;")}" href="/images/search?view=detailV2&amp;thid=OIP.${m.md5}&amp;expw=${w}&amp;exph=${h}&amp;q=x">`;
    const html = [
      item({ md5: "good", murl: "https://site.com/a.jpg", purl: "https://site.com/page", t: "A tea house" }, 2400, 1600),
      item({ md5: "screenshot", murl: "https://site.com/screen.png", purl: "https://site.com/app", t: "App screenshot.png" }, 1280, 720),
      item({ md5: "stock", murl: "https://www.shutterstock.com/x.jpg", purl: "https://www.shutterstock.com/p", t: "Stock" }, 2400, 1600),
      item({ md5: "ai", murl: "https://lummi.ai/x.jpg", purl: "https://lummi.ai/p", t: "Nice" }, 2400, 1600),
      item({ md5: "aitld", murl: "https://cdn.feeldesign.ai/x.jpg", purl: "https://feeldesign.ai/p", t: "Nice" }, 2400, 1600),
      item({ md5: "small", murl: "https://site.com/s.jpg", purl: "https://site.com/s", t: "Small" }, 640, 480),
      item({ md5: "mock", murl: "https://site.com/m.jpg", purl: "https://site.com/m", t: "Laptop mockup template" }, 2400, 1600),
    ].join("");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(html, { status: 200 })));
    const out = await media.searchWeb("tea house");
    vi.unstubAllGlobals();
    expect(out.map((c) => c.id)).toEqual(["web:good", "web:screenshot"]);
    expect(out[0].original).toBe("https://site.com/a.jpg");
    expect(out[1].original).toBe("https://site.com/screen.png");
    expect(out[0].license).toMatch(/unknown/i);
  });

  it("extracts URLs, domains, and entity names from user input", () => {
    const r1 = media.extractUrlsAndDomains("https://obsidian.md/ and its use cases");
    expect(r1.urls).toEqual(["https://obsidian.md/"]);
    expect(r1.domain).toBe("obsidian.md");
    expect(r1.entity).toBe("Obsidian");

    const r2 = media.extractUrlsAndDomains("how to use linear.app for agile sprints");
    expect(r2.urls).toEqual(["https://linear.app"]);
    expect(r2.domain).toBe("linear.app");
    expect(r2.entity).toBe("Linear");
  });

  it("scrapes site images including OG banner and high-res screenshots", async () => {
    const pageHtml = `
      <html>
        <head>
          <meta property="og:image" content="https://example.com/banner.png" />
        </head>
        <body>
          <img src="/screen1.png" alt="Dashboard view" width="1920" height="1080" />
          <img src="/icon.svg" alt="Icon" width="24" height="24" />
        </body>
      </html>
    `;
    vi.stubGlobal("fetch", vi.fn(async () => new Response(pageHtml, { status: 200 })));
    const candidates = await media.scrapeSiteImages("https://example.com");
    vi.unstubAllGlobals();
    expect(candidates.length).toBe(2);
    expect(candidates[0].full).toBe("https://example.com/banner.png");
    expect(candidates[1].full).toBe("https://example.com/screen1.png");
    expect(candidates[1].title).toBe("Dashboard view");
  });

  it("scrapes DuckDuckGo images and parses direct URLs", async () => {
    const ddgTokenHtml = `<html><script>vqd="123456"</script></html>`;
    const ddgApiJson = JSON.stringify({
      results: [
        { title: "App Screenshot", image: "https://cdn.example.com/obsidian.png", thumbnail: "https://tse.bing.net/th?id=1", url: "https://example.com/post", width: 1920, height: 1080 },
        { title: "Small Icon", image: "https://cdn.example.com/icon.png", url: "https://example.com/i", width: 64, height: 64 },
      ],
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        if (String(url).includes("i.js")) return new Response(ddgApiJson, { status: 200 });
        return new Response(ddgTokenHtml, { status: 200 });
      }),
    );
    const ddgResults = await media.searchDuckDuckGo("Obsidian editor");
    vi.unstubAllGlobals();
    expect(ddgResults.length).toBe(1);
    expect(ddgResults[0].full).toBe("https://cdn.example.com/obsidian.png");
    expect(ddgResults[0].title).toBe("App Screenshot");
  });
});
