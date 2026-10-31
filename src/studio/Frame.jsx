import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { buildFrameDoc, resolveImages, systemVars } from "../design/frameDoc.js";
import { cachedCss, saveCss } from "../design/cssCache.js";

// One screen, rendered in a sandboxed iframe. The iframe only reloads when
// the screen's HTML changes from outside (or fonts/icons change); token edits
// are pushed live, and edits the frame already shows (inline text) are not
// reloaded.
export const Frame = forwardRef(function Frame(
  { id, html, system, kit = [], mode = "view", width, height, viewportHeight = null, canvas = false, onMessage, streaming = null, title, className, style },
  ref,
) {
  const iframe = useRef(null);
  const latest = useRef(html);
  latest.current = html;
  const expected = useRef(new Set());
  const ready = useRef(false);
  const waiters = useRef(new Map());
  const [rev, setRev] = useState(0);

  // What the frame currently shows, which can differ from the HTML its
  // document was built from once live patches land.
  const shown = useRef(html);
  useEffect(() => {
    if (html === shown.current) {
      return;
    }
    shown.current = html;
    if (expected.current.has(html)) {
      expected.current.delete(html);
      return;
    }
    setRev((r) => r + 1);
  }, [html]);

  const fontsKey = `${system.fonts?.display}|${system.fonts?.body}|${system.fonts?.mono}|${system.icons?.set}`;
  const kitKey = kit.map((k) => k.url || "").join("|");
  // The revision stamp forces a reload even when the rebuilt document matches
  // the last one, e.g. undo back to the HTML the frame loaded before a live patch.
  const doc = useMemo(
    () => buildFrameDoc({ html: latest.current, system, kit, mode, frameId: id, width, vh: viewportHeight, canvas, css: streaming === null ? cachedCss(latest.current) : null }) + `<!--${rev}-->`,
    // Rebuild only for content, fonts, icon set, painted images or width.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rev, fontsKey, kitKey, width, viewportHeight, streaming === null],
  );

  // A new document isn't ready until its bridge says so.
  useEffect(() => {
    ready.current = false;
  }, [doc]);

  const post = (msg) => iframe.current?.contentWindow?.postMessage({ __pq: 1, ...msg }, "*");

  // Live token updates.
  const varsKey = JSON.stringify(systemVars(system));
  useEffect(() => {
    if (ready.current) {
      post({ type: "vars", vars: systemVars(system) });
    }
  }, [varsKey]);

  // Mode changes without reloading.
  useEffect(() => {
    if (ready.current) {
      post({ type: "mode", mode });
    }
  }, [mode]);

  // Partial HTML while a screen is being written.
  useEffect(() => {
    if (streaming !== null && ready.current) {
      post({ type: "stream", html: resolveImages(streaming, system, kit) });
    }
  }, [streaming]);

  useEffect(() => {
    const onMsg = (e) => {
      if (!iframe.current || e.source !== iframe.current.contentWindow || !e.data?.__pq) {
        return;
      }
      const m = e.data;
      if (m.type === "css") {
        // Compiled CSS for what the frame shows; never for a half-written screen.
        if (streaming === null && shown.current) saveCss(shown.current, m.css);
        return;
      }
      if (m.type === "ready") {
        ready.current = true;
        post({ type: "vars", vars: systemVars(system) });
        if (streaming !== null) {
          post({ type: "stream", html: resolveImages(streaming, system, kit) });
        }
      }
      if (m.id && waiters.current.has(m.id)) {
        waiters.current.get(m.id)(m);
        waiters.current.delete(m.id);
        return;
      }
      onMessage?.(m);
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  });

  const request = (type, timeout = 4000) =>
    new Promise((resolve) => {
      const reqId = Math.random().toString(36).slice(2);
      waiters.current.set(reqId, resolve);
      post({ type, id: reqId });
      setTimeout(() => {
        if (waiters.current.has(reqId)) {
          waiters.current.delete(reqId);
          resolve(null);
        }
      }, timeout);
    });

  useImperativeHandle(ref, () => ({
    post,
    // The next time `html` arrives with this value, don't reload: the frame
    // already shows it.
    expect: (next) => expected.current.add(next),
    audit: async () => (await request("audit"))?.result || null,
    getHtml: async () => (await request("html"))?.html || null,
  }));

  return (
    <iframe
      ref={iframe}
      title={title || id}
      sandbox="allow-scripts"
      srcDoc={doc}
      className={className}
      style={{ width, height, border: 0, display: "block", background: system.colors?.bg, ...style }}
    />
  );
});
