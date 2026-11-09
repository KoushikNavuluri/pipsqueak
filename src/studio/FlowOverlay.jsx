import { memo } from "react";
import { ArrowRight, Workflow } from "lucide-react";

export const FlowOverlay = memo(function FlowOverlay({ flows = [], placed = [], onSelectScreen }) {
  if (!flows.length || !placed.length) return null;

  const placedMap = new Map();
  placed.forEach((p) => placedMap.set(p.id, p));

  // Compute SVG bounding box to encompass all screen coordinates
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  placed.forEach((p) => {
    minX = Math.min(minX, p.x - 200);
    minY = Math.min(minY, p.y - 100);
    maxX = Math.max(maxX, p.x + p.w + 200);
    maxY = Math.max(maxY, p.y + p.h + 100);
  });

  const curves = flows.map((flow) => {
    const from = placedMap.get(flow.fromScreenId);
    const to = placedMap.get(flow.toScreenId);
    if (!from || !to) return null;

    // Anchor points: right edge of source, left edge of target (or top/bottom if stacked)
    let x1, y1, x2, y2, cp1x, cp1y, cp2x, cp2y;

    if (to.x > from.x) {
      // Source is left of target
      x1 = from.x + from.w;
      y1 = from.y + Math.min(from.h * 0.4, 240);
      x2 = to.x;
      y2 = to.y + Math.min(to.h * 0.4, 240);
      const dx = Math.max(60, (x2 - x1) * 0.5);
      cp1x = x1 + dx;
      cp1y = y1;
      cp2x = x2 - dx;
      cp2y = y2;
    } else {
      // Loopback curve: target is to the left or below
      x1 = from.x + from.w * 0.5;
      y1 = from.y + from.h;
      x2 = to.x + to.w * 0.5;
      y2 = to.y;
      const dy = Math.max(100, Math.abs(y2 - y1) * 0.4);
      cp1x = x1;
      cp1y = y1 + dy;
      cp2x = x2;
      cp2y = y2 - dy;
    }

    // Midpoint for the label pill
    const t = 0.5;
    const midX = (1 - t) ** 3 * x1 + 3 * (1 - t) ** 2 * t * cp1x + 3 * (1 - t) * t ** 2 * cp2x + t ** 3 * x2;
    const midY = (1 - t) ** 3 * y1 + 3 * (1 - t) ** 2 * t * cp1y + 3 * (1 - t) * t ** 2 * cp2y + t ** 3 * y2;

    const pathData = `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;

    return {
      flow,
      pathData,
      midX,
      midY,
      x1,
      y1,
      x2,
      y2,
    };
  }).filter(Boolean);

  if (!curves.length) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <svg
        className="overflow-visible"
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "100%",
          height: "100%",
        }}
      >
        <defs>
          <linearGradient id="flow-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FF4D1A" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#E03A00" stopOpacity="0.9" />
          </linearGradient>
          <marker
            id="flow-arrow"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 9 5 L 0 9 z" fill="#FF4D1A" />
          </marker>
        </defs>

        {curves.map(({ flow, pathData }, idx) => (
          <g key={flow.id || idx}>
            {/* Glow backing */}
            <path
              d={pathData}
              fill="none"
              stroke="#FF4D1A"
              strokeWidth="6"
              strokeOpacity="0.15"
              strokeLinecap="round"
            />
            {/* Main connecting line */}
            <path
              d={pathData}
              fill="none"
              stroke="url(#flow-gradient)"
              strokeWidth="2.5"
              strokeDasharray="6 4"
              strokeLinecap="round"
              markerEnd="url(#flow-arrow)"
              className="animate-[dash_1.5s_linear_infinite]"
            />
          </g>
        ))}
      </svg>

      {/* Floating interactive pills at midpoints */}
      {curves.map(({ flow, midX, midY }, idx) => (
        <div
          key={`pill-${flow.id || idx}`}
          style={{
            position: "absolute",
            left: `${midX}px`,
            top: `${midY}px`,
            transform: "translate(-50%, -50%)",
          }}
          className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-accent/40 bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-accent-deep shadow-md backdrop-blur transition-transform hover:scale-105 hover:border-accent"
        >
          <Workflow size={11} className="text-accent" />
          <span className="max-w-[120px] truncate">{flow.label}</span>
          <ArrowRight size={10} className="text-mute" />
          <span className="text-[10px] uppercase tracking-wider text-mute">{flow.transition || "tap"}</span>
        </div>
      ))}
    </div>
  );
});
