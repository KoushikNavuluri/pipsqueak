// Dynamic Open Graph SVG preview card generator for Pipsqueak share links
export default function handler(req, res) {
  const { title = "Pipsqueak Prototype", tagline = "Interactive prototype designed in Pipsqueak", screens = "3" } = req.query || {};

  const cleanTitle = String(title).slice(0, 60).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const cleanTagline = String(tagline).slice(0, 100).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const screenCount = parseInt(screens, 10) || 1;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <radialGradient id="glow" cx="20%" cy="30%" r="60%">
      <stop offset="0%" stop-color="#FF4D1A" stop-opacity="0.18" />
      <stop offset="100%" stop-color="#141416" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="cardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#232220" />
      <stop offset="100%" stop-color="#181714" />
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="#12110E" />
  <rect width="1200" height="630" fill="url(#glow)" />

  <!-- Grid decoration lines -->
  <line x1="80" y1="0" x2="80" y2="630" stroke="#FFFFFF" stroke-opacity="0.04" stroke-width="1" />
  <line x1="1120" y1="0" x2="1120" y2="630" stroke="#FFFFFF" stroke-opacity="0.04" stroke-width="1" />
  <line x1="0" y1="120" x2="1200" y2="120" stroke="#FFFFFF" stroke-opacity="0.04" stroke-width="1" />
  <line x1="0" y1="510" x2="1200" y2="510" stroke="#FFFFFF" stroke-opacity="0.04" stroke-width="1" />

  <!-- Brand Header -->
  <g transform="translate(100, 70)">
    <circle cx="20" cy="20" r="16" fill="#FF4D1A" />
    <circle cx="20" cy="20" r="7" fill="#FFFFFF" />
    <text x="48" y="27" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="700" fill="#FFFFFF" letter-spacing="-0.02em">Pipsqueak</text>
  </g>

  <!-- Project Content Card -->
  <g transform="translate(100, 160)">
    <rect width="1000" height="360" rx="28" fill="url(#cardGrad)" stroke="#FFFFFF" stroke-opacity="0.08" stroke-width="1.5" />

    <!-- Badges -->
    <g transform="translate(48, 48)">
      <rect width="130" height="32" rx="16" fill="#FF4D1A" fill-opacity="0.14" />
      <text x="65" y="21" font-family="system-ui, sans-serif" font-size="13" font-weight="600" fill="#FF4D1A" text-anchor="middle">LIVE PROTOTYPE</text>

      <rect x="144" width="94" height="32" rx="16" fill="#FFFFFF" fill-opacity="0.08" />
      <text x="191" y="21" font-family="system-ui, sans-serif" font-size="13" font-weight="500" fill="#A0A0A5" text-anchor="middle">${screenCount} SCREENS</text>
    </g>

    <!-- Title -->
    <text x="48" y="145" font-family="system-ui, -apple-system, sans-serif" font-size="52" font-weight="800" fill="#FFFFFF" letter-spacing="-0.03em">${cleanTitle}</text>

    <!-- Tagline -->
    <text x="48" y="200" font-family="system-ui, -apple-system, sans-serif" font-size="24" font-weight="400" fill="#908F8B" letter-spacing="-0.01em">${cleanTagline}</text>

    <!-- Palette dots & Footer line -->
    <g transform="translate(48, 280)">
      <circle cx="12" cy="12" r="10" fill="#FF4D1A" />
      <circle cx="40" cy="12" r="10" fill="#3B82F6" />
      <circle cx="68" cy="12" r="10" fill="#10B981" />
      <circle cx="96" cy="12" r="10" fill="#F59E0B" />
      <text x="124" y="17" font-family="system-ui, sans-serif" font-size="14" font-weight="500" fill="#666560">Interactive canvas design engine</text>
    </g>
  </g>
</svg>`;

  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400");
  res.status(200).send(svg);
}
