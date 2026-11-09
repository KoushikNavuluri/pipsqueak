import { memo } from "react";

export const RemoteCursors = memo(function RemoteCursors({ cursors = [] }) {
  if (!cursors.length) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-visible">
      {cursors.map((c) => {
        const color = c.color || "#FF4D1A";
        return (
          <div
            key={c.userId}
            style={{
              position: "absolute",
              left: `${c.x}px`,
              top: `${c.y}px`,
              transform: "translate(0, 0)",
              transition: "left 0.08s ease-out, top 0.08s ease-out",
            }}
            className="flex items-start gap-1 will-change-transform"
          >
            {/* SVG cursor arrow */}
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              className="drop-shadow-sm"
              style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.25))" }}
            >
              <path
                d="M5.65376 12.3673H5.46026L5.31717 12.4976L0.500002 16.8829L0.500002 1.19841L11.7841 12.3673H5.65376Z"
                fill={color}
                stroke="#FFFFFF"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>

            {/* Name pill */}
            <div
              style={{ backgroundColor: color }}
              className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white shadow-md"
            >
              {c.avatar && (
                <img
                  src={c.avatar}
                  alt=""
                  className="h-3.5 w-3.5 rounded-full object-cover ring-1 ring-white/50"
                />
              )}
              <span className="max-w-[100px] truncate">{c.name}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
});
