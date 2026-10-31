// Cleans model-written HTML and edits it by element path. A path is the list
// of element-child indexes from <body> down, the same scheme the in-frame
// bridge reports, so a click in a frame maps to an exact node here.

const parse = (html) => new DOMParser().parseFromString(`<!doctype html><html><body>${html}</body></html>`, "text/html");

// Pulls the screen out of whatever the model returned: code fences, a full
// document, or a bare fragment.
export function extractHtml(raw) {
  let s = String(raw || "").trim();
  const fence = /```(?:html)?\s*([\s\S]*?)(?:```|$)/i.exec(s);
  if (fence && s.startsWith("```")) {
    s = fence[1];
  }
  const body = /<body[^>]*>([\s\S]*?)(?:<\/body>|$)/i.exec(s);
  if (body) {
    const styles = [...s.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi)]
      .map((m) => m[0])
      .filter((st) => !/tailwindcss/.test(st));
    s = styles.join("\n") + body[1];
  }
  return s.trim();
}

const ICON_CLASS = /\b(material-symbols-(outlined|rounded|sharp)|material-icons(-\w+)?)\b/;

// Removes anything that could run code or pull in outside styles, and
// normalizes icon markup to the system's icon class.
export function sanitizeHtml(html) {
  const doc = parse(extractHtml(html));
  doc.body.querySelectorAll("script, iframe, object, embed, link, meta, base, noscript").forEach((el) => el.remove());
  doc.body.querySelectorAll("*").forEach((el) => {
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on") || (/^(href|src|action|formaction|xlink:href)$/.test(name) && /^\s*javascript:/i.test(attr.value))) {
        el.removeAttribute(attr.name);
      }
    }
    const cls = el.getAttribute("class");
    if (cls && ICON_CLASS.test(cls)) {
      el.setAttribute("class", cls.replace(ICON_CLASS, "icon").replace(/\bmaterial-symbols-\w+\b/g, "").trim());
    }
    if (el.tagName === "A" && el.getAttribute("href") && !el.getAttribute("href").startsWith("#")) {
      el.setAttribute("href", "#");
    }
  });
  return doc.body.innerHTML.trim();
}

export function elementAt(html, path) {
  const doc = parse(html);
  let el = doc.body;
  for (const i of path || []) {
    el = el?.children[i];
  }
  return el && el !== doc.body ? el.outerHTML : null;
}

// Replaces the element at path with new markup (one or more nodes).
export function replaceAt(html, path, outer) {
  const doc = parse(html);
  let el = doc.body;
  for (const i of path || []) {
    el = el?.children[i];
  }
  if (!el || el === doc.body) {
    return html;
  }
  const tpl = doc.createElement("template");
  tpl.innerHTML = sanitizeHtml(outer);
  el.replaceWith(...tpl.content.childNodes);
  return doc.body.innerHTML.trim();
}

export function updateAt(html, path, fn) {
  const doc = parse(html);
  let el = doc.body;
  for (const i of path || []) {
    el = el?.children[i];
  }
  if (!el || el === doc.body) {
    return html;
  }
  fn(el);
  return doc.body.innerHTML.trim();
}

export function removeAt(html, path) {
  return updateAt(html, path, (el) => el.remove());
}

export function duplicateAt(html, path) {
  return updateAt(html, path, (el) => el.after(el.cloneNode(true)));
}

// Screens in a plan link to each other with data-nav. Returns the ids used.
export function navTargets(html) {
  return [...new Set([...html.matchAll(/data-nav="([^"]+)"/g)].map((m) => m[1]))];
}

// ---------- HTML to JSX, for the React export ----------

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const ATTR = {
  class: "className",
  for: "htmlFor",
  tabindex: "tabIndex",
  readonly: "readOnly",
  maxlength: "maxLength",
  colspan: "colSpan",
  rowspan: "rowSpan",
  autocomplete: "autoComplete",
  autofocus: "autoFocus",
  srcset: "srcSet",
  crossorigin: "crossOrigin",
  viewbox: "viewBox",
  "stroke-width": "strokeWidth",
  "stroke-linecap": "strokeLinecap",
  "stroke-linejoin": "strokeLinejoin",
  "stroke-dasharray": "strokeDasharray",
  "stroke-dashoffset": "strokeDashoffset",
  "fill-rule": "fillRule",
  "clip-rule": "clipRule",
  "stop-color": "stopColor",
  "stop-opacity": "stopOpacity",
  "font-size": "fontSize",
  "font-weight": "fontWeight",
  "text-anchor": "textAnchor",
};
const BOOL = new Set(["checked", "disabled", "selected", "readonly", "required", "multiple", "autofocus", "hidden", "open"]);

const jsxText = (s) => s.replace(/[{}<>]/g, (c) => `{"${c}"}`);
const styleObject = (css) =>
  "{{ " +
  css
    .split(";")
    .map((d) => d.trim())
    .filter(Boolean)
    .map((d) => {
      const i = d.indexOf(":");
      const prop = d.slice(0, i).trim();
      const value = d.slice(i + 1).trim();
      const key = prop.startsWith("--") ? JSON.stringify(prop) : prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      return `${key}: ${JSON.stringify(value)}`;
    })
    .join(", ") +
  " }}";

function nodeToJsx(node, indent, onNav) {
  const pad = "  ".repeat(indent);
  if (node.nodeType === 3) {
    const t = node.textContent.replace(/\s+/g, " ");
    return t.trim() ? pad + jsxText(t.trim()) : "";
  }
  if (node.nodeType !== 1) {
    return "";
  }
  const tag = node.tagName.toLowerCase();
  if (tag === "style") {
    return `${pad}<style>{${JSON.stringify(node.textContent)}}</style>`;
  }
  const attrs = [...node.attributes]
    .map((a) => {
      const name = a.name.toLowerCase();
      if (name === "style") {
        return `style=${styleObject(a.value)}`;
      }
      if (name === "data-nav" && onNav) {
        return `onClick={() => go(${JSON.stringify(a.value)})} data-nav=${JSON.stringify(a.value)}`;
      }
      const key = ATTR[name] || name;
      if (name === "checked") {
        return "defaultChecked";
      }
      if (name === "value" && (tag === "input" || tag === "textarea")) {
        return `defaultValue=${JSON.stringify(a.value)}`;
      }
      if (BOOL.has(name)) {
        return a.value === "" || a.value === name ? key : `${key}=${JSON.stringify(a.value)}`;
      }
      return `${key}=${JSON.stringify(a.value)}`;
    })
    .join(" ");
  const open = `${pad}<${tag}${attrs ? " " + attrs : ""}`;
  if (VOID.has(tag)) {
    return `${open} />`;
  }
  const kids = [...node.childNodes].map((c) => nodeToJsx(c, indent + 1, onNav)).filter(Boolean);
  if (!kids.length) {
    return `${open} />`;
  }
  return `${open}>\n${kids.join("\n")}\n${pad}</${tag}>`;
}

export function htmlToJsx(html, { indent = 2, onNav = true } = {}) {
  const doc = parse(html);
  const nodes = [...doc.body.childNodes].map((n) => nodeToJsx(n, indent, onNav)).filter(Boolean);
  return nodes.join("\n");
}
