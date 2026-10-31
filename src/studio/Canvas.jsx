import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { cx } from "../ui";

const MIN = 0.08;
const MAX = 2;
const clampZoom = (z) => Math.min(MAX, Math.max(MIN, z));

// An infinite, pannable, zoomable surface. Content is laid out in canvas
// coordinates; the view transform is { x, y, z }.
export const Canvas = forwardRef(function Canvas({ children, onBackgroundClick, className, tool = "select" }, ref) {
  const viewport = useRef(null);
  const [view, setView] = useState({ x: 80, y: 80, z: 0.5 });
  const [panning, setPanning] = useState(false);
  const [space, setSpace] = useState(false);
  const drag = useRef(null);
  const viewRef = useRef(view);
  viewRef.current = view;

  const zoomAt = useCallback((factor, cx0, cy0) => {
    setView((v) => {
      const z = clampZoom(v.z * factor);
      const k = z / v.z;
      return { z, x: cx0 - (cx0 - v.x) * k, y: cy0 - (cy0 - v.y) * k };
    });
  }, []);

  // Fits rect in view. With minZoom, a rect too wide to stay legible is shown
  // from its left edge at minZoom instead of shrinking further.
  const fit = useCallback((rect, pad = 80, minZoom = 0) => {
    const el = viewport.current;
    if (!el || !rect || rect.w <= 0) {
      return;
    }
    const { width, height } = el.getBoundingClientRect();
    const byHeight = (height - pad * 2) / rect.h;
    const z = clampZoom(Math.max(Math.min((width - pad * 2) / rect.w, byHeight, 1), Math.min(minZoom, byHeight)));
    const x = rect.w * z <= width - pad * 2 ? (width - rect.w * z) / 2 : pad;
    setView({ z, x: x - rect.x * z, y: Math.max(pad, (height - rect.h * z) / 2) - rect.y * z });
  }, []);

  useImperativeHandle(ref, () => ({
    fit,
    zoomBy: (factor) => {
      const r = viewport.current.getBoundingClientRect();
      zoomAt(factor, r.width / 2, r.height / 2);
    },
    setZoom: (z) => {
      const r = viewport.current.getBoundingClientRect();
      zoomAt(z / viewRef.current.z, r.width / 2, r.height / 2);
    },
    // Zoom coming from inside a frame (pinch over an iframe).
    wheelFromFrame: (dy, clientX, clientY) => {
      const r = viewport.current.getBoundingClientRect();
      zoomAt(Math.exp(-dy * 0.01), clientX - r.left, clientY - r.top);
    },
    view: () => viewRef.current,
    panBy: (dx, dy) => setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy })),
  }));

  useEffect(() => {
    const el = viewport.current;
    const onWheel = (e) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX - r.left, e.clientY - r.top);
      } else {
        setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  useEffect(() => {
    const down = (e) => {
      if (e.code === "Space" && !/input|textarea|select/i.test(e.target.tagName) && !e.target.isContentEditable) {
        e.preventDefault();
        setSpace(true);
      }
    };
    const up = (e) => {
      if (e.code === "Space") {
        setSpace(false);
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const handTool = tool === "hand" || space;

  const onPointerDown = (e) => {
    const onBackground = e.target === viewport.current || e.target.dataset.canvasBg !== undefined;
    if (e.button === 1 || handTool || (e.button === 0 && onBackground)) {
      e.preventDefault();
      drag.current = { x: e.clientX, y: e.clientY, moved: false, background: onBackground };
      viewport.current.setPointerCapture(e.pointerId);
      setPanning(true);
    }
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) {
      return;
    }
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 2) {
      d.moved = true;
    }
    d.x = e.clientX;
    d.y = e.clientY;
    setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    setPanning(false);
    if (d && !d.moved && d.background) {
      onBackgroundClick?.();
    }
  };

  return (
    <div
      ref={viewport}
      data-canvas-bg=""
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className={cx("dots relative h-full w-full touch-none select-none overflow-hidden", handTool ? (panning ? "cursor-grabbing" : "cursor-grab") : "", className)}
      style={{ backgroundPosition: `${view.x}px ${view.y}px`, backgroundSize: `${Math.max(14, 22 * view.z)}px ${Math.max(14, 22 * view.z)}px` }}
    >
      <div
        style={{
          transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.z})`,
          transformOrigin: "0 0",
          position: "absolute",
          left: 0,
          top: 0,
          willChange: "transform",
        }}
      >
        {children(view)}
      </div>
      {/* While panning with the hand, frames must not swallow the pointer. */}
      {handTool && <div className="absolute inset-0" data-canvas-bg="" />}
    </div>
  );
});
