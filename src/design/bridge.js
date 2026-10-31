// Runs inside every screen's sandboxed iframe and talks to the studio with
// postMessage. It never sees the studio's data: it only reports what the user
// points at and applies the changes the studio asks for.
function bridgeMain() {
  var cfg = window.__PQ || {};
  var mode = cfg.mode || "view";
  var editing = null;
  var selected = null;
  var hoverBox, selBox, tag;

  function send(type, data) {
    var msg = { __pq: 1, frame: cfg.frameId, type: type };
    for (var k in data || {}) msg[k] = data[k];
    parent.postMessage(msg, "*");
  }
  // Tailwind's compiler: already in the document, or loaded on demand when the
  // frame was opened from cached CSS and an edit needs new classes.
  var twReady = !cfg.tw;
  function ensureTw() {
    if (twReady) return;
    twReady = true;
    var st = document.createElement("style");
    st.type = "text/tailwindcss";
    st.textContent = cfg.tw.theme;
    document.head.appendChild(st);
    var sc = document.createElement("script");
    sc.src = cfg.tw.src;
    document.head.appendChild(sc);
    watchCss();
  }
  // Hands the compiled CSS back to the app so later renders can skip compiling.
  var cssTimer = null;
  function reportCss() {
    var list = document.head.querySelectorAll("style:not([id]):not([type])");
    var st = list[list.length - 1];
    if (st && st.textContent.length > 200) send("css", { css: st.textContent });
  }
  function watchCss() {
    new MutationObserver(function () {
      clearTimeout(cssTimer);
      cssTimer = setTimeout(reportCss, 400);
    }).observe(document.head, { childList: true, subtree: true, characterData: true });
    setTimeout(reportCss, 1500);
  }
  if (twReady) watchCss();
  function ours(el) {
    return el && el.closest && el.closest("[data-pq-ui]");
  }
  function pathOf(el) {
    var p = [];
    while (el && el !== document.body) {
      var parentEl = el.parentElement;
      if (!parentEl) return null;
      var i = 0;
      var sib = el;
      while ((sib = sib.previousElementSibling)) i++;
      p.unshift(i);
      el = parentEl;
    }
    return p;
  }
  function byPath(p) {
    var el = document.body;
    for (var i = 0; p && i < p.length && el; i++) el = el.children[p[i]];
    return el && el !== document.body ? el : null;
  }
  function overlay(style) {
    var d = document.createElement("div");
    d.setAttribute("data-pq-ui", "");
    d.style.cssText = "position:fixed;pointer-events:none;z-index:2147483646;display:none;border-radius:4px;" + style;
    document.body.appendChild(d);
    return d;
  }
  function place(box, el) {
    if (!box) return;
    if (!el || !el.isConnected) {
      box.style.display = "none";
      return;
    }
    var r = el.getBoundingClientRect();
    box.style.display = "block";
    box.style.left = r.left - 2 + "px";
    box.style.top = r.top - 2 + "px";
    box.style.width = r.width + 4 + "px";
    box.style.height = r.height + 4 + "px";
    if (box === selBox && tag) {
      tag.style.display = "block";
      tag.textContent = el.tagName.toLowerCase();
      tag.style.left = Math.max(2, r.left - 2) + "px";
      tag.style.top = (r.top > 22 ? r.top - 22 : r.bottom + 4) + "px";
    }
  }
  function isTextLeaf(el) {
    if (!el || !el.innerText || !el.innerText.trim()) return false;
    for (var i = 0; i < el.children.length; i++) {
      var c = el.children[i];
      if (!/^(SPAN|B|I|EM|STRONG|BR|A|SMALL|SUP|SUB|MARK|U)$/.test(c.tagName) || c.classList.contains("icon")) return false;
    }
    return true;
  }
  function describe(el) {
    var r = el.getBoundingClientRect();
    var cs = getComputedStyle(el);
    return {
      path: pathOf(el),
      tag: el.tagName.toLowerCase(),
      text: (el.innerText || "").trim().slice(0, 240),
      className: el.getAttribute("class") || "",
      rect: { x: r.left, y: r.top, w: r.width, h: r.height },
      outer: el.outerHTML.slice(0, 8000),
      editable: isTextLeaf(el),
      style: { color: cs.color, background: cs.backgroundColor, fontSize: cs.fontSize, fontWeight: cs.fontWeight, fontFamily: cs.fontFamily.split(",")[0].replace(/"/g, "") },
    };
  }
  function select(el) {
    selected = el;
    place(selBox, el);
    if (!el && tag) tag.style.display = "none";
  }
  function contentHtml() {
    var clone = document.body.cloneNode(true);
    var junk = clone.querySelectorAll("[data-pq-ui], script");
    for (var i = 0; i < junk.length; i++) junk[i].remove();
    var ce = clone.querySelectorAll("[contenteditable]");
    for (var j = 0; j < ce.length; j++) ce[j].removeAttribute("contenteditable");
    return clone.innerHTML.trim();
  }
  function startEdit(el) {
    editing = el;
    var before = el.innerHTML;
    el.setAttribute("contenteditable", "true");
    el.style.outline = "none";
    el.focus();
    var range = document.createRange();
    range.selectNodeContents(el);
    var sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    place(hoverBox, null);
    function done(save) {
      el.removeEventListener("blur", onBlur);
      el.removeEventListener("keydown", onKey);
      el.removeAttribute("contenteditable");
      el.style.outline = "";
      editing = null;
      if (!save) el.innerHTML = before;
      else if (el.innerHTML !== before) send("text", { path: pathOf(el), html: contentHtml() });
      place(selBox, el);
    }
    function onBlur() {
      done(true);
    }
    function onKey(e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        el.blur();
      } else if (e.key === "Escape") {
        e.preventDefault();
        done(false);
      }
    }
    el.addEventListener("blur", onBlur);
    el.addEventListener("keydown", onKey);
  }

  // ----- audit -----
  var cvs = document.createElement("canvas");
  cvs.width = cvs.height = 1;
  var ctx = cvs.getContext("2d", { willReadFrequently: true });
  function rgba(color) {
    if (!color || color === "transparent") return [0, 0, 0, 0];
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = "#000";
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    var d = ctx.getImageData(0, 0, 1, 1).data;
    // Alpha is only present as a fourth comma value (rgba) or after a slash.
    var alpha = 1;
    var inner = /\(([^)]*)\)/.exec(color);
    if (inner) {
      var raw = null;
      if (inner[1].indexOf("/") >= 0) raw = inner[1].split("/")[1].trim();
      else if (/^rgba|^hsla/.test(color)) {
        var parts = inner[1].split(",");
        if (parts.length === 4) raw = parts[3].trim();
      }
      if (raw) alpha = raw.indexOf("%") > 0 ? parseFloat(raw) / 100 : parseFloat(raw);
    }
    return [d[0], d[1], d[2], isNaN(alpha) ? 1 : alpha];
  }
  function lum(c) {
    var a = [c[0], c[1], c[2]].map(function (v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  }
  function bgOf(el) {
    var layers = [];
    while (el && el.nodeType === 1) {
      var cs = getComputedStyle(el);
      if (cs.backgroundImage && cs.backgroundImage !== "none") return null;
      var c = rgba(cs.backgroundColor);
      if (c[3] > 0) {
        layers.push(c);
        if (c[3] >= 0.99) break;
      }
      el = el.parentElement;
    }
    var out = [255, 255, 255];
    for (var i = layers.length - 1; i >= 0; i--) {
      var l = layers[i];
      out = [l[0] * l[3] + out[0] * (1 - l[3]), l[1] * l[3] + out[1] * (1 - l[3]), l[2] * l[3] + out[2] * (1 - l[3])];
    }
    return out;
  }
  function audit() {
    var issues = [];
    var mobile = innerWidth < 600;
    var all = document.body.querySelectorAll("*");
    for (var i = 0; i < all.length && issues.length < 40; i++) {
      var el = all[i];
      if (ours(el) || el.tagName === "SCRIPT" || el.tagName === "STYLE") continue;
      var r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      var cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none" || parseFloat(cs.opacity) < 0.1) continue;
      var ownText = "";
      for (var n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 3) ownText += n.textContent;
      ownText = ownText.trim();
      var isIcon = el.classList.contains("icon");
      if (ownText && !isIcon) {
        var fg = rgba(cs.color);
        var bg = bgOf(el);
        if (bg && fg[3] > 0.2) {
          var blended = [fg[0] * fg[3] + bg[0] * (1 - fg[3]), fg[1] * fg[3] + bg[1] * (1 - fg[3]), fg[2] * fg[3] + bg[2] * (1 - fg[3])];
          var L1 = lum(blended);
          var L2 = lum(bg);
          var ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
          var size = parseFloat(cs.fontSize);
          var large = size >= 24 || (size >= 18.6 && parseInt(cs.fontWeight, 10) >= 700);
          var need = large ? 3 : 4.5;
          if (ratio < need - 0.05) {
            issues.push({ kind: "contrast", severity: ratio < need - 1.5 ? "high" : "medium", path: pathOf(el), text: ownText.slice(0, 60), message: "Text contrast " + ratio.toFixed(1) + ":1, needs " + need + ":1" });
          }
        }
        if (parseFloat(cs.fontSize) < 11) {
          issues.push({ kind: "tiny-text", severity: "medium", path: pathOf(el), text: ownText.slice(0, 60), message: "Text is " + cs.fontSize + ", too small to read comfortably" });
        }
        if (el.scrollWidth > el.clientWidth + 2 && cs.overflowX !== "auto" && cs.overflowX !== "scroll" && cs.textOverflow !== "ellipsis" && el.clientWidth > 0) {
          issues.push({ kind: "overflow", severity: "high", path: pathOf(el), text: ownText.slice(0, 60), message: "Text overflows its box" });
        }
      }
      if (r.right > innerWidth + 1 && r.left < innerWidth) {
        var scroller = el.parentElement;
        var clipped = false;
        while (scroller && scroller !== document.body) {
          var ox = getComputedStyle(scroller).overflowX;
          if (ox === "auto" || ox === "scroll" || ox === "hidden" || ox === "clip") {
            clipped = true;
            break;
          }
          scroller = scroller.parentElement;
        }
        if (!clipped && !ours(el)) {
          issues.push({ kind: "spill", severity: "high", path: pathOf(el), text: (el.innerText || "").trim().slice(0, 60), message: "Runs past the right edge of the screen" });
        }
      }
      if (mobile && (el.tagName === "BUTTON" || el.hasAttribute("data-nav")) && (r.width < 36 || r.height < 32) && !el.closest("p")) {
        issues.push({ kind: "tap-target", severity: "low", path: pathOf(el), text: (el.innerText || el.getAttribute("aria-label") || "").trim().slice(0, 40), message: "Tap target is " + Math.round(r.width) + "×" + Math.round(r.height) + "px; aim for 44×44" });
      }
      if (el.tagName === "IMG" && el.complete && el.naturalWidth === 0) {
        issues.push({ kind: "image", severity: "medium", path: pathOf(el), text: el.getAttribute("alt") || "", message: "Image failed to load" });
      }
    }
    var families = {};
    var texts = document.body.querySelectorAll("h1,h2,h3,h4,p,span,a,button,li,label,td,th,div");
    for (var t = 0; t < texts.length; t++) {
      if (ours(texts[t]) || texts[t].classList.contains("icon")) continue;
      var f = getComputedStyle(texts[t]).fontFamily.split(",")[0].replace(/"/g, "").trim();
      families[f] = (families[f] || 0) + 1;
    }
    return { issues: issues, families: families, height: document.body.scrollHeight };
  }

  // ----- events -----
  function ready() {
    hoverBox = overlay("border:1.5px dashed rgba(255,77,26,.7);");
    selBox = overlay("border:2px solid #FF4D1A;box-shadow:0 0 0 4px rgba(255,77,26,.15);transition:all .12s cubic-bezier(.2,.8,.2,1);");
    tag = overlay("border-radius:4px;background:#FF4D1A;color:#fff;font:600 10px/1 ui-monospace,monospace;padding:4px 6px;height:auto;width:auto;");
    tag.style.display = "none";
    send("size", { h: document.body.scrollHeight });
    var done = function () {
      send("ready", { h: document.body.scrollHeight });
    };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(done);
    else done();
    if (window.ResizeObserver) {
      new ResizeObserver(function () {
        send("size", { h: document.body.scrollHeight });
        place(selBox, selected);
      }).observe(document.body);
    }
  }
  document.addEventListener("mouseover", function (e) {
    if (mode !== "edit" || editing) return;
    var t = e.target;
    if (ours(t) || t === document.body || t === document.documentElement) return place(hoverBox, null);
    place(hoverBox, t);
  }, true);
  document.addEventListener("mouseleave", function () {
    place(hoverBox, null);
  });
  document.addEventListener("click", function (e) {
    if (mode === "edit") {
      if (editing && editing.contains(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      var t = e.target;
      if (ours(t)) return;
      if (t === document.body || t === document.documentElement) {
        select(null);
        send("select", { path: null });
        return;
      }
      select(t);
      send("select", describe(t));
      return;
    }
    var link = e.target.closest("a,button,[role=button],input[type=submit]");
    if (link) e.preventDefault();
    var nav = e.target.closest("[data-nav]");
    if (nav) {
      e.preventDefault();
      send("navigate", { to: nav.getAttribute("data-nav") });
    } else if (mode === "play" && link) {
      send("tap", { text: (link.innerText || "").trim().slice(0, 40) });
    }
  }, true);
  document.addEventListener("dblclick", function (e) {
    if (mode !== "edit") return;
    var t = e.target;
    while (t && t !== document.body && !isTextLeaf(t)) t = t.parentElement;
    if (t && t !== document.body && !ours(t)) {
      e.preventDefault();
      select(t);
      startEdit(t);
    }
  }, true);
  document.addEventListener("submit", function (e) {
    e.preventDefault();
  }, true);
  addEventListener("scroll", function () {
    place(selBox, selected);
    place(hoverBox, null);
  }, true);
  addEventListener("keydown", function (e) {
    if (editing) return;
    if (e.key === "Escape" || ((e.metaKey || e.ctrlKey) && /^[zyk]$/i.test(e.key))) {
      send("key", { key: e.key, meta: e.metaKey || e.ctrlKey, shift: e.shiftKey });
    }
  });
  addEventListener("message", function (e) {
    if (e.source !== parent || !e.data || !e.data.__pq) return;
    var m = e.data;
    if (m.type === "mode") {
      mode = m.mode;
      if (mode !== "edit") {
        place(hoverBox, null);
        select(null);
      }
    } else if (m.type === "select") {
      var el = byPath(m.path);
      select(el);
      if (el && m.scroll) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      if (el && m.report) send("select", describe(el));
    } else if (m.type === "patch") {
      var target = byPath(m.path);
      if (target) {
        if (m.className !== undefined) {
          ensureTw();
          target.setAttribute("class", m.className);
        }
        if (m.text !== undefined) target.textContent = m.text;
        requestAnimationFrame(function () {
          place(selBox, selected);
          if (target === selected) send("select", describe(target));
        });
      }
    } else if (m.type === "vars") {
      for (var k in m.vars) document.documentElement.style.setProperty(k, m.vars[k]);
    } else if (m.type === "audit") {
      send("audit", { id: m.id, result: audit() });
    } else if (m.type === "html") {
      send("html", { id: m.id, html: contentHtml() });
    } else if (m.type === "scroll") {
      window.scrollTo({ top: m.top || 0, behavior: m.smooth ? "smooth" : "auto" });
    } else if (m.type === "hints") {
      document.documentElement.classList.toggle("pq-hints", !!m.on);
    } else if (m.type === "stream") {
      ensureTw();
      // Replace the screen while it is still being written, keeping our UI.
      var keep = document.body.querySelectorAll("[data-pq-ui], script");
      var holder = document.createElement("div");
      holder.innerHTML = m.html;
      document.body.textContent = "";
      while (holder.firstChild) document.body.appendChild(holder.firstChild);
      for (var q = 0; q < keep.length; q++) document.body.appendChild(keep[q]);
      document.documentElement.classList.add("pq-streaming");
    }
  });
  // Whether something under the pointer can still scroll in the wheel's direction.
  function canScroll(el, dx, dy) {
    for (; el && el.nodeType === 1; el = el.parentElement) {
      var st = getComputedStyle(el);
      var root = el === document.documentElement || el === document.body;
      if (dy && (root || /auto|scroll/.test(st.overflowY)) && el.scrollHeight > el.clientHeight + 1) {
        if ((dy < 0 && el.scrollTop > 0) || (dy > 0 && el.scrollTop + el.clientHeight < el.scrollHeight - 1)) return true;
      }
      if (dx && (root || /auto|scroll/.test(st.overflowX)) && el.scrollWidth > el.clientWidth + 1) {
        if ((dx < 0 && el.scrollLeft > 0) || (dx > 0 && el.scrollLeft + el.clientWidth < el.scrollWidth - 1)) return true;
      }
    }
    return false;
  }
  addEventListener("wheel", function (e) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      send("wheel", { dx: e.deltaX, dy: e.deltaY, x: e.clientX, y: e.clientY, zoom: true });
    } else if (cfg.canvas && !canScroll(e.target, e.deltaX, e.deltaY)) {
      // Nothing here to scroll: let the canvas pan instead.
      e.preventDefault();
      send("wheel", { dx: e.deltaX, dy: e.deltaY, x: e.clientX, y: e.clientY, zoom: false });
    }
  }, { passive: false });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready);
  else ready();
}

export const BRIDGE = "(" + bridgeMain.toString() + ")();";
