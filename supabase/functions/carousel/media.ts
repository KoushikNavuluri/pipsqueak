// Finding, checking and storing images for carousel slides.
//
// Sources:
//   web        Bing image search results (any site). Licenses are unknown, so
//              every result is labelled with its source page for the credits.
//   wikimedia  Wikimedia Commons: real, named places, people and things.
//   openverse  Openly licensed photos (Flickr and others), commercial use only.
//
// Chosen images are copied into the public `carousel-media` bucket so that
// carousels keep working when the original disappears, and so the browser
// can draw them into exported PNGs (the bucket allows cross-origin reads).

import { HttpError } from "./gemini.ts";

export type Candidate = {
  id: string;
  source: "web" | "wikimedia" | "openverse" | "upload" | "ai";
  thumb: string;
  full: string;
  original?: string;
  page?: string;
  title?: string;
  width?: number;
  height?: number;
  credit?: string;
  license?: string;
};

const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";
const BOT_UA = "PipsqueakBot/1.0 (https://pipsqueak-five.vercel.app; carousel image search)";

// Stock agencies whose previews carry watermarks.
const WATERMARKED = /(shutterstock|istockphoto|gettyimages|alamy|dreamstime|depositphotos|123rf|stock\.adobe|vectorstock|canstockphoto|bigstockphoto|agefotostock|pond5|colourbox|stockfresh|megapixl|featurepics|fotosearch|crushpixel|superstock|stocksy|masterfile|eyeem)\./i;

// Sites that mostly serve AI-generated stock, templates or mockups.
const SYNTHETIC = /(lummi\.ai|stockcake|freepik|pngtree|vecteezy|lexica\.art|openart\.ai|nightcafe|civitai|playground(ai)?\.com|craiyon|starryai|deepai|imagine\.art|aiartists|stablediffusionweb|wallpapers?\.ai|getimg\.ai|pixlr|mockup|templatemonster|envato|creativemarket|graphicriver|rawpixel)/i;

const AI_AUTHOR = /(ai[- ]generated|generated (by|with|for)|midjourney|dall[·-]?e|stable diffusion|meta ai|chatgpt|gemini|imagen|firefly|muse spark|flux)/i;

const decode = (s: string) =>
  s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

const hostOf = (u?: string) => {
  try {
    return u ? new URL(u).hostname.replace(/^www\./, "") : "";
  } catch {
    return "";
  }
};

const stripTags = (s: string) => decode(String(s || "").replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();

// ---------- Safe fetching ----------

// Blocks requests to this machine, private networks and odd ports. Redirects
// are followed by hand so every hop is checked.
export function isPrivateAddress(h: string) {
  h = h.toLowerCase().replace(/^\[|\]$/g, "");
  return (
    h === "localhost" ||
    h.endsWith(".localhost") ||
    h.endsWith(".internal") ||
    h.endsWith(".local") ||
    (!h.includes(".") && !h.includes(":")) ||
    /^(0|10|127)\./.test(h) ||
    /^169\.254\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(h) ||
    /^\d+$/.test(h) ||
    /^0x/.test(h) ||
    (h.includes(":") && (h === "::" || h === "::1" || /^f[cd]/.test(h) || h.startsWith("fe80") || h.startsWith("::ffff:")))
  );
}

async function assertPublicUrl(raw: string) {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new HttpError(400, "That isn't a valid link.");
  }
  if (!["http:", "https:"].includes(u.protocol)) throw new HttpError(400, "Only http and https links work.");
  if (u.port && !["80", "443"].includes(u.port)) throw new HttpError(400, "That link uses an unusual port.");
  if (u.username || u.password) throw new HttpError(400, "Links with passwords aren't allowed.");
  if (isPrivateAddress(u.hostname)) throw new HttpError(400, "That link points to a private address.");
  // Also check what the name resolves to, where the runtime can tell us.
  // Some runtimes don't allow DNS lookups (and may throw synchronously); then
  // the name checks above are what we have.
  const lookup = async (type: "A" | "AAAA") => {
    try {
      return await (Deno as any).resolveDns(u.hostname, type);
    } catch {
      return [];
    }
  };
  if (typeof (Deno as any).resolveDns === "function" && !/^[\d.]+$/.test(u.hostname) && !u.hostname.includes(":")) {
    const ips = await Promise.all([lookup("A"), lookup("AAAA")]);
    if (ips.flat().some((ip: string) => isPrivateAddress(String(ip)))) throw new HttpError(400, "That link points to a private address.");
  }
  return u;
}

export async function safeFetch(raw: string, init: RequestInit & { timeoutMs?: number } = {}) {
  let url = (await assertPublicUrl(raw)).toString();
  for (let hop = 0; hop < 4; hop++) {
    const res = await fetch(url, {
      ...init,
      redirect: "manual",
      signal: AbortSignal.timeout(init.timeoutMs ?? 8000),
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      await res.body?.cancel();
      url = (await assertPublicUrl(new URL(res.headers.get("location")!, url).toString())).toString();
      continue;
    }
    return res;
  }
  throw new HttpError(400, "That link redirects too many times.");
}

// Reads at most `max` bytes; throws when the body is larger.
async function readCapped(res: Response, max: number) {
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel();
      throw new HttpError(413, "That image is too large.");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

// The real type of an image file from its first bytes (SVG is never allowed:
// it can carry scripts and the bucket is public).
export function sniffImage(b: Uint8Array): { mime: string; ext: string } | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { mime: "image/png", ext: "png" };
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) {
    return { mime: "image/webp", ext: "webp" };
  }
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70 && String.fromCharCode(b[8], b[9], b[10], b[11]).startsWith("avi")) {
    return { mime: "image/avif", ext: "avif" };
  }
  return null;
}

export async function fetchImage(url: string, max = 9_000_000, timeoutMs = 9000) {
  const res = await safeFetch(url, {
    timeoutMs,
    headers: { "User-Agent": url.includes("wikimedia.org") ? BOT_UA : BROWSER_UA, Accept: "image/avif,image/webp,image/jpeg,image/png,image/*;q=0.8" },
  });
  if (!res.ok) {
    await res.body?.cancel();
    throw new HttpError(502, `The image host answered ${res.status}.`);
  }
  const bytes = await readCapped(res, max);
  const kind = sniffImage(bytes);
  if (!kind) throw new HttpError(415, "That link isn't a JPEG, PNG, WebP or AVIF image.");
  if (bytes.length < 2000) throw new HttpError(415, "That image is too small.");
  return { bytes, ...kind };
}

// ---------- Search & Scraping providers ----------

export function extractUrlsAndDomains(text: string): { urls: string[]; domain: string; entity: string } {
  const urls: string[] = [];
  const urlMatches = text.match(/https?:\/\/[^\s"'<>()]+/gi) || [];
  for (const u of urlMatches) {
    try {
      urls.push(new URL(u).href);
    } catch {}
  }
  const domainMatches = text.match(/\b([a-zA-Z0-9-]+\.(?:md|app|io|ai|com|org|net|dev|co|so|sh))\b/gi) || [];
  for (const d of domainMatches) {
    const candidate = "https://" + d.toLowerCase();
    if (!urls.some((u) => u.startsWith(candidate))) {
      urls.push(candidate);
    }
  }
  let domain = "";
  let entity = "";
  if (urls.length > 0) {
    try {
      domain = new URL(urls[0]).hostname.replace(/^www\./, "");
      entity = domain.split(".")[0];
      entity = entity.charAt(0).toUpperCase() + entity.slice(1);
    } catch {}
  }
  return { urls, domain, entity };
}

// Scrapes high-resolution images, OG banners, and screenshots directly from a target website.
export async function scrapeSiteImages(siteUrl: string, maxPages = 4): Promise<Candidate[]> {
  let base: URL;
  try {
    base = new URL(siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`);
  } catch {
    return [];
  }
  const domain = base.hostname.replace(/^www\./, "");
  const pagesToScrape = [base.href];
  const candidates: Candidate[] = [];
  const seen = new Set<string>();

  try {
    const res = await safeFetch(base.href, {
      headers: { "User-Agent": BROWSER_UA, Accept: "text/html,application/xhtml+xml" },
      timeoutMs: 6000,
    });
    if (!res.ok) return [];
    const html = await res.text();

    for (const m of html.matchAll(/href=["'](\/[a-zA-Z0-9_\-\/]+)["']/gi)) {
      const path = m[1];
      if (/^\/(canvas|features|mobile|publish|sync|about|desktop|screenshots|product|gallery|showcase|app)/i.test(path)) {
        try {
          const full = new URL(path, base).href;
          if (!pagesToScrape.includes(full) && pagesToScrape.length < maxPages) {
            pagesToScrape.push(full);
          }
        } catch {}
      }
    }

    for (const pageUrl of pagesToScrape) {
      try {
        const pageRes = pageUrl === base.href ? { ok: true, text: async () => html } : await safeFetch(pageUrl, {
          headers: { "User-Agent": BROWSER_UA, Accept: "text/html,application/xhtml+xml" },
          timeoutMs: 5000,
        });
        if (!pageRes.ok) continue;
        const pageHtml = await pageRes.text();
        const pageBase = new URL(pageUrl);

        // 1. og:image and twitter:image
        for (const m of pageHtml.matchAll(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["']/gi)) {
          try {
            const u = new URL(decode(m[1]), pageBase).href;
            if (!seen.has(u) && !u.endsWith(".svg") && !u.startsWith("data:")) {
              seen.add(u);
              candidates.push({
                id: `site:${await sha1(u)}`,
                source: "web",
                thumb: u,
                full: u,
                original: u,
                page: pageUrl,
                title: `${domain} official banner / preview`,
                credit: domain,
                license: `Official imagery from ${domain}`,
              });
            }
          } catch {}
        }

        // 2. img tags
        for (const m of pageHtml.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)) {
          const tag = m[0];
          const src = decode(m[1]);
          if (src.endsWith(".svg") || src.startsWith("data:") || src.includes("avatar") || src.includes("icon")) continue;
          try {
            const u = new URL(src, pageBase).href;
            if (seen.has(u)) continue;
            const alt = stripTags(/alt=["']([^"']*)["']/i.exec(tag)?.[1] || "");
            const w = Number(/width=["']?(\d+)/i.exec(tag)?.[1] || 0);
            const h = Number(/height=["']?(\d+)/i.exec(tag)?.[1] || 0);
            if (w && h && (w < 200 || h < 150)) continue;
            seen.add(u);
            candidates.push({
              id: `site:${await sha1(u)}`,
              source: "web",
              thumb: u,
              full: u,
              original: u,
              page: pageUrl,
              title: alt || `${domain} screenshot`,
              width: w || undefined,
              height: h || undefined,
              credit: domain,
              license: `Official imagery from ${domain}`,
            });
          } catch {}
        }
      } catch (err) {
        console.error("Subpage scraping failed", pageUrl, String(err));
      }
    }
  } catch (err) {
    console.error("Site scraping failed", base.href, String(err));
  }
  return candidates;
}

const bingThumb = (thid: string, w: number, h: number) => `https://th.bing.com/th/id/${thid}?w=${w}&h=${h}&rs=1&p=0`;

export async function searchWeb(query: string, { licensed = false } = {}): Promise<Candidate[]> {
  const filters = "+filterui:imagesize-large" + (licensed ? "+filterui:license-L2_L3_L4" : "");
  const url = `https://www.bing.com/images/async?q=${encodeURIComponent(query)}&first=0&count=35&qft=${encodeURIComponent(filters)}&mmasync=1&adlt=strict&setlang=en`;
  let html = "";
  try {
    const res = await fetch(url, { headers: { "User-Agent": BROWSER_UA, "Accept-Language": "en-US,en;q=0.9" }, signal: AbortSignal.timeout(7000) });
    if (!res.ok) {
      console.error("Bing answered", res.status);
      return [];
    }
    html = await res.text();
  } catch (err) {
    console.error("Bing search failed", String(err));
    return [];
  }
  const out: Candidate[] = [];
  for (const tag of html.match(/<a[^>]+class="iusc"[^>]*>/g) ?? []) {
    try {
      const m = JSON.parse(decode(/\sm="([^"]+)"/.exec(tag)?.[1] ?? ""));
      const href = decode(/\shref="([^"]+)"/.exec(tag)?.[1] ?? "");
      const params = new URLSearchParams(href.split("?")[1] ?? "");
      const thid = params.get("thid") || "";
      const width = Number(params.get("expw")) || 0;
      const height = Number(params.get("exph")) || 0;
      if (!m.murl || !thid || !/^OIP\.[\w-]+$/.test(thid)) continue;
      const hosts = `${hostOf(m.murl)} ${hostOf(m.purl)}`;
      if (WATERMARKED.test(hosts) || SYNTHETIC.test(hosts) || /\.ai(\s|$)/.test(hosts) || /\b(ai[- ]generated|template|clipart|vectorstock)\b/i.test(m.t || "")) continue;
      // Big enough for high-DPI slides, allowing standard 720p/1080p desktop & app screenshots.
      if (width && height && (Math.max(width, height) < 1000 || Math.min(width, height) < 450 || width / height > 2.5 || height / width > 2.6)) continue;
      out.push({
        id: `web:${m.md5 || thid}`,
        source: "web",
        thumb: bingThumb(thid, 480, 600),
        full: bingThumb(thid, 1600, 2000),
        original: m.murl,
        page: m.purl,
        title: stripTags(m.t || m.desc || "").slice(0, 140),
        width,
        height,
        credit: hostOf(m.purl) || hostOf(m.murl),
        license: licensed ? "Free to share and use commercially (per Bing's license filter); check the source" : "Unknown: check the source page before publishing",
      });
    } catch {
      // Skip a result we can't read.
    }
  }
  return out;
}

export async function searchDuckDuckGo(query: string, { licensed = false } = {}): Promise<Candidate[]> {
  try {
    const tokenUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&t=h_&iax=images&ia=images`;
    const tokenRes = await safeFetch(tokenUrl, {
      headers: { "User-Agent": BROWSER_UA },
      timeoutMs: 6000,
    });
    if (!tokenRes.ok) return [];
    const html = await tokenRes.text();
    const vqd = /vqd=([0-9-]+)/.exec(html)?.[1] || /vqd=["']([0-9-]+)["']/.exec(html)?.[1];
    if (!vqd) return [];

    const licenseParam = licensed ? "&f=,,license:commercial," : "&f=,,,";
    const apiRes = await safeFetch(`https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(query)}&vqd=${vqd}${licenseParam}`, {
      headers: { "User-Agent": BROWSER_UA, Referer: "https://duckduckgo.com/" },
      timeoutMs: 6000,
    });
    if (!apiRes.ok) return [];
    const data = await apiRes.json();
    const results: Candidate[] = [];
    const seen = new Set<string>();

    for (const r of data?.results ?? []) {
      if (!r.image || !r.url) continue;
      const width = Number(r.width) || 0;
      const height = Number(r.height) || 0;
      if (width && height) {
        if (Math.max(width, height) < 1000 || Math.min(width, height) < 450) continue;
        if (width / height > 2.5 || height / width > 2.6) continue;
      }
      const hosts = `${hostOf(r.image)} ${hostOf(r.url)}`;
      if (WATERMARKED.test(hosts) || SYNTHETIC.test(hosts) || /\.ai(\s|$)/.test(hosts)) continue;
      if (/\b(ai[- ]generated|template|clipart|vectorstock)\b/i.test(r.title || "")) continue;

      const key = r.image;
      if (seen.has(key)) continue;
      seen.add(key);

      results.push({
        id: `ddg:${await sha1(r.image)}`,
        source: "web",
        thumb: r.thumbnail || r.image,
        full: r.image,
        original: r.image,
        page: r.url,
        title: stripTags(r.title || "").slice(0, 140),
        width,
        height,
        credit: hostOf(r.url) || hostOf(r.image),
        license: licensed ? "Commercial use per DuckDuckGo filter" : "Unknown: check the source page before publishing",
      });
      if (results.length >= 25) break;
    }
    return results;
  } catch (err) {
    console.error("DuckDuckGo search failed", String(err));
    return [];
  }
}

export async function searchWikimedia(query: string): Promise<Candidate[]> {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=8&gsrsearch=${encodeURIComponent(`${query} filetype:bitmap`)}&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=1600&iiextmetadatafilter=LicenseShortName|Artist|ObjectName`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": BOT_UA }, signal: AbortSignal.timeout(7000) });
    if (!res.ok) return [];
    const data = await res.json();
    const pages = Object.values<any>(data?.query?.pages ?? {}).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    const out: Candidate[] = [];
    for (const p of pages) {
      const info = p.imageinfo?.[0];
      if (!info?.thumburl || !/^image\/(jpeg|png|webp)$/.test(info.mime || "")) continue;
      if (Math.min(info.width || 0, info.height || 0) < 1000) continue;
      const meta = info.extmetadata || {};
      // Commons hosts AI-generated images too; their author line says so.
      if (AI_AUTHOR.test(`${stripTags(meta.Artist?.value || "")} ${p.title || ""}`)) continue;
      out.push({
        id: `wikimedia:${p.pageid}`,
        source: "wikimedia",
        thumb: String(info.thumburl).replace(/\/\d+px-/, "/500px-"),
        full: info.thumburl,
        original: info.url,
        page: info.descriptionurl,
        title: stripTags(meta.ObjectName?.value || p.title?.replace(/^File:/, "") || "").slice(0, 140),
        width: info.width,
        height: info.height,
        credit: stripTags(meta.Artist?.value || "Wikimedia Commons").slice(0, 120),
        license: stripTags(meta.LicenseShortName?.value || "See source page"),
      });
    }
    return out;
  } catch (err) {
    console.error("Wikimedia search failed", String(err));
    return [];
  }
}

export async function searchOpenverse(query: string): Promise<Candidate[]> {
  const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&page_size=8&license_type=commercial&mature=false&size=large`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": BOT_UA }, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.results ?? [])
      .filter((r: any) => r.url && r.id && !/\.svg($|\?)/i.test(r.url))
      .map((r: any): Candidate => ({
        id: `openverse:${r.id}`,
        source: "openverse",
        thumb: `https://api.openverse.org/v1/images/${r.id}/thumb/`,
        full: r.url,
        original: r.url,
        page: r.foreign_landing_url,
        title: String(r.title || "").slice(0, 140),
        width: r.width || 0,
        height: r.height || 0,
        credit: String(r.creator || r.source || "Openverse").slice(0, 120),
        license: `${String(r.license || "").toUpperCase()} ${r.license_version || ""}`.trim(),
      }));
  } catch (err) {
    console.error("Openverse search failed", String(err));
    return [];
  }
}

// Candidates for one image need: web results (Bing + DuckDuckGo), plus Commons for named
// things, site candidates from direct scraping, and openly licensed photos when requested.
export async function findCandidates(
  need: { query: string; altQuery?: string; kind?: string },
  {
    licensed = false,
    limit = 8,
    siteCandidates = [],
    entityName = "",
  }: { licensed?: boolean; limit?: number; siteCandidates?: Candidate[]; entityName?: string } = {},
) {
  const q = need.query.trim();
  const alt = (need.altQuery || "").trim();
  const entityQ = entityName && !q.toLowerCase().includes(entityName.toLowerCase()) ? `${entityName} ${q}` : "";

  const jobs: Promise<Candidate[]>[] = [
    searchWeb(q, { licensed }),
    searchDuckDuckGo(q, { licensed }),
  ];
  if (entityQ) {
    jobs.push(searchDuckDuckGo(entityQ, { licensed }));
  }
  if (need.kind === "entity") jobs.push(searchWikimedia(q));
  if (licensed) jobs.push(searchOpenverse(q));

  let lists = await Promise.all(jobs);
  if (lists.flat().length < 4 && alt) {
    const altEntityQ = entityName && !alt.toLowerCase().includes(entityName.toLowerCase()) ? `${entityName} ${alt}` : "";
    lists = [
      ...lists,
      ...(await Promise.all([
        searchWeb(alt, { licensed }),
        searchDuckDuckGo(alt, { licensed }),
        altEntityQ ? searchDuckDuckGo(altEntityQ, { licensed }) : Promise.resolve([]),
        licensed ? searchOpenverse(alt) : Promise.resolve([]),
      ])),
    ];
  }

  const merged: Candidate[] = [];
  const seen = new Set<string>();
  const add = (c?: Candidate) => {
    if (!c) return;
    const key = c.original || c.full;
    if (seen.has(key) || seen.has(c.id)) return;
    seen.add(key);
    seen.add(c.id);
    merged.push(c);
  };

  // 1. Add matching official site candidates first
  if (siteCandidates.length > 0) {
    const qWords = `${q} ${alt}`.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const scoredSite = siteCandidates.map((c) => {
      const text = `${c.title || ""} ${c.full || ""}`.toLowerCase();
      const score = qWords.reduce((acc, w) => acc + (text.includes(w) ? 2 : 0), 0);
      return { c, score };
    });
    scoredSite.sort((a, b) => b.score - a.score);
    for (const { c } of scoredSite.slice(0, 4)) {
      add(c);
    }
  }

  const [web = [], ddg = [], ...rest] = lists;
  const extra = rest.flat();

  // Named things: trusted publishers and official sites first, and sizes that
  // image generators use (1024², 1536×1024…) last.
  const AI_SIZES = new Set(["1024x1024", "1536x1024", "1024x1536", "1792x1024", "1024x1792", "1344x768", "768x1344"]);
  const TRUSTED = /(^|\.)(meta\.com|about\.fb\.com|fb\.com|apple\.com|google\.com|microsoft\.com|theverge\.com|techcrunch\.com|engadget\.com|cnet\.com|wired\.com|reuters\.com|apnews\.com|bloomberg\.com|nytimes\.com|bbc\.(com|co\.uk)|cnbc\.com|tomsguide\.com|zdnet\.com|arstechnica\.com|businessinsider\.com|nasa\.gov|wikipedia\.org|wikimedia\.org|github\.com)$/i;
  const score = (c: Candidate) => (TRUSTED.test(c.credit || "") ? 0 : 1) + (AI_SIZES.has(`${c.width}x${c.height}`) ? 2 : 0);

  const combinedWeb = [...ddg, ...web];
  if (need.kind === "entity") combinedWeb.sort((a, b) => score(a) - score(b));
  else combinedWeb.sort((a, b) => (AI_SIZES.has(`${a.width}x${a.height}`) ? 1 : 0) - (AI_SIZES.has(`${b.width}x${b.height}`) ? 1 : 0));

  for (let i = 0; merged.length < limit * 2 && (i < combinedWeb.length || i < extra.length); i++) {
    if (need.kind === "entity" || licensed) add(extra[i]);
    add(combinedWeb[i]);
    if (!(need.kind === "entity" || licensed)) add(extra[i]);
  }

  // If we still need more candidates and have site candidates, fill with remaining site candidates
  for (const c of siteCandidates) {
    if (merged.length >= limit) break;
    add(c);
  }

  return merged.slice(0, limit);
}

// Small JPEG/PNG/WebP thumbnails, base64, for the photo editor model.
export async function thumbnailsFor(cands: Candidate[], concurrency = 16) {
  const out = new Map<string, { mimeType: string; data: string }>();
  let i = 0;
  const work = async () => {
    while (i < cands.length) {
      const c = cands[i++];
      try {
        const img = await fetchImage(c.thumb, 1_500_000, 6000);
        if (img.mime === "image/avif") continue;
        out.set(c.id, { mimeType: img.mime, data: toBase64(img.bytes) });
      } catch {
        // A candidate whose preview won't load isn't offered to the model.
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, cands.length) }, work));
  return out;
}

export function toBase64(bytes: Uint8Array) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function fromBase64(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function sha1(text: string | Uint8Array) {
  const data = typeof text === "string" ? new TextEncoder().encode(text) : new Uint8Array(text);
  const digest = await crypto.subtle.digest("SHA-1", data as Uint8Array<ArrayBuffer>);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 24);
}

export const MEDIA_BUCKET = "carousel-media";

// Copies an image into the user's folder in the media bucket; returns its public URL.
export async function storeBytes(admin: any, userId: string, folder: string, bytes: Uint8Array, kind: { mime: string; ext: string }, key?: string) {
  const name = `${await sha1(key ?? bytes)}.${kind.ext}`;
  const path = `${userId}/${folder}/${name}`;
  const { error } = await admin.storage.from(MEDIA_BUCKET).upload(path, bytes, { contentType: kind.mime, upsert: true, cacheControl: "31536000" });
  if (error) throw new Error("Couldn't store the image: " + error.message);
  return admin.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl as string;
}

// Stores a candidate. Web results try the original file first (sharpest),
// then the search engine's resized copy when the original is blocked,
// missing or over 6 MB. Commons and Openverse use their sized copy first.
export async function pinCandidate(admin: any, userId: string, folder: string, c: Candidate) {
  let lastErr: unknown = null;
  const order = c.source === "web" ? [c.original, c.full] : [c.full, c.original];
  for (const url of order.filter((u, i, a): u is string => !!u && a.indexOf(u) === i)) {
    try {
      const img = await fetchImage(url, url === c.original && c.source === "web" ? 6_000_000 : 9_000_000);
      return await storeBytes(admin, userId, folder, img.bytes, img, url);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof HttpError ? lastErr : new HttpError(502, "That image couldn't be downloaded. Pick another one.");
}

// Strips a web page to readable text for "make a carousel from this article".
export async function readPage(url: string) {
  const ghMatch = /^https?:\/\/(?:www\.)?github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)(?:\/.*)?$/i.exec(url.trim());
  if (ghMatch) {
    const [, owner, repoRaw] = ghMatch;
    const repo = repoRaw.replace(/\.git$/i, "");
    try {
      const apiRes = await safeFetch(`https://api.github.com/repos/${owner}/${repo}`, {
        timeoutMs: 8000,
        headers: { "User-Agent": BROWSER_UA, Accept: "application/vnd.github.v3+json" },
      });
      const repoInfo = apiRes.ok ? await apiRes.json() : null;
      const rawRes = await safeFetch(`https://raw.githubusercontent.com/${owner}/${repo}/HEAD/README.md`, {
        timeoutMs: 8000,
        headers: { "User-Agent": BROWSER_UA },
      });
      const readme = rawRes.ok ? new TextDecoder().decode(await readCapped(rawRes, 500_000)) : "";

      const parts = [
        `GitHub Repository: ${owner}/${repo}`,
        repoInfo?.description ? `Description: ${repoInfo.description}` : "",
        repoInfo?.stargazers_count ? `Stars: ${Number(repoInfo.stargazers_count).toLocaleString()}★` : "",
        repoInfo?.language ? `Language: ${repoInfo.language}` : "",
        repoInfo?.topics?.length ? `Topics: ${repoInfo.topics.join(", ")}` : "",
        readme ? `README Overview:\n${readme.slice(0, 8000)}` : "",
      ].filter(Boolean);

      const fullText = parts.join("\n\n");
      if (fullText.length > 100) {
        return {
          title: `${owner}/${repo}${repoInfo?.stargazers_count ? ` (${Number(repoInfo.stargazers_count).toLocaleString()}★)` : ""}: ${repoInfo?.description || "Architecture & Breakdown"}`,
          text: fullText.slice(0, 12000),
        };
      }
    } catch {
      // Fallback to standard web scraping
    }
  }

  const res = await safeFetch(url, { timeoutMs: 9000, headers: { "User-Agent": BROWSER_UA, Accept: "text/html,text/plain" } });
  if (!res.ok) throw new HttpError(422, `That page answered ${res.status}. Paste its text instead.`);
  const type = res.headers.get("content-type") || "";
  if (!/text\/(html|plain)|application\/xhtml/.test(type)) throw new HttpError(422, "That link isn't a web page. Paste its text instead.");
  const raw = new TextDecoder().decode(await readCapped(res, 3_000_000));
  const title = stripTags(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(raw)?.[1] ?? "").slice(0, 200);
  const body = raw
    .replace(/<(script|style|noscript|svg|nav|footer|header|form|aside)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|h[1-6]|li|br|section|article|blockquote)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  const text = decode(body)
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 40)
    .join("\n")
    .slice(0, 12000);
  if (text.length < 200) throw new HttpError(422, "Pip couldn't read that page. Paste its text instead.");
  return { title, text };
}
