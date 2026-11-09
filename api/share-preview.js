// Crawler and preview handler for /s/:token and /poll/:token links
export default async function handler(req, res) {
  const { token, mode } = req.query || {};
  const origin = req.headers["x-forwarded-proto"] && req.headers["x-forwarded-host"]
    ? `${req.headers["x-forwarded-proto"]}://${req.headers["x-forwarded-host"]}`
    : "https://pipsqueak-five.vercel.app";

  let title = "Interactive Prototype · Pipsqueak";
  let description = "Tap through this interactive design prototype made with Pipsqueak.";
  let screens = "3";
  let destination = `/s/${token || ""}`;

  if (mode === "poll") {
    title = "Design Direction Poll · Pipsqueak";
    description = "Vote on your favorite design direction and compare variants side-by-side.";
    destination = `/poll/${token || ""}`;
  }

  // Fetch Supabase project info if token provided
  if (token) {
    try {
      const SUPABASE_URL = "https://gvqheqgkdbdpmwduvivs.supabase.co";
      const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2cWhlcWdrZGJkcG13ZHV2aXZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0MjQyNDcsImV4cCI6MjEwODk5OTI0N30.rL0H7L6q8G37rQf9o69nL_c84i-dGgE22M8C8n_vL6M";
      const rpcName = mode === "poll" ? "get_poll" : "get_share";
      const body = mode === "poll" ? { p_token: token } : { p_token: token };

      const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${rpcName}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: ANON_KEY,
          Authorization: `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify(body),
      });

      if (resp.ok) {
        const data = await resp.json();
        if (mode === "poll" && data?.question) {
          title = `${data.question} · Pipsqueak Poll`;
          description = `Vote on ${data.options?.length || 2} design directions on Pipsqueak.`;
        } else if (data?.project?.name) {
          title = `${data.project.name} · Designed with Pipsqueak`;
          if (data.project.tagline) description = data.project.tagline;
          if (data.project.screens?.length) screens = String(data.project.screens.length);
        }
      }
    } catch {}
  }

  const ogImageUrl = `${origin}/api/og?title=${encodeURIComponent(title)}&tagline=${encodeURIComponent(description)}&screens=${screens}`;

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <meta name="robots" content="index,follow">

  <!-- Open Graph -->
  <meta property="og:type" content="website">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${ogImageUrl}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url" content="${origin}${destination}">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${ogImageUrl}">

  <!-- Human redirect -->
  <meta http-equiv="refresh" content="0;url=${destination}">
  <script>location.href = "${destination}";</script>
</head>
<body style="background:#12110E;color:#fff;font-family:system-ui,sans-serif;padding:40px;text-align:center;">
  <h1>${title}</h1>
  <p>${description}</p>
  <p><a href="${destination}" style="color:#FF4D1A;font-weight:600;">Open Prototype &rarr;</a></p>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400");
  res.status(200).send(html);
}
