// Screen flow and prototype link extraction and manipulation.

/**
 * Extracts all navigation connections between screens based on data-nav attributes.
 * @param {Array} screens List of project screens with id, name, html
 * @returns {Array} Array of connections: { fromScreenId, toScreenId, label, transition, fromScreenName, toScreenName }
 */
export function extractScreenFlows(screens) {
  if (!Array.isArray(screens)) return [];
  const flows = [];
  const screenMap = new Map();

  screens.forEach((sc) => {
    if (!sc) return;
    screenMap.set(sc.id, sc);
    if (sc.name) {
      screenMap.set(sc.name.trim().toLowerCase(), sc);
    }
  });

  screens.forEach((sc) => {
    if (!sc || !sc.html) return;
    try {
      const doc = new DOMParser().parseFromString(`<body>${sc.html}</body>`, "text/html");
      const navEls = doc.querySelectorAll("[data-nav]");
      navEls.forEach((el) => {
        const targetRaw = el.getAttribute("data-nav")?.trim();
        if (!targetRaw) return;
        const targetScreen = screenMap.get(targetRaw) || screenMap.get(targetRaw.toLowerCase());
        if (targetScreen && targetScreen.id !== sc.id) {
          flows.push({
            id: `${sc.id}->${targetScreen.id}:${el.textContent?.trim().slice(0, 20) || "nav"}`,
            fromScreenId: sc.id,
            toScreenId: targetScreen.id,
            fromScreenName: sc.name,
            toScreenName: targetScreen.name,
            label: (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 30) || targetScreen.name,
            transition: el.getAttribute("data-transition") || "slide",
          });
        }
      });
    } catch (e) {
      console.warn("Error parsing screen flow:", e);
    }
  });

  return flows;
}

/**
 * Updates or removes a navigation link on an element in screen HTML.
 */
export function setElementNavigation(html, path, targetScreenId, transition = "slide") {
  if (!html || !Array.isArray(path)) return html;
  try {
    const doc = new DOMParser().parseFromString(`<!doctype html><html><body>${html}</body></html>`, "text/html");
    let el = doc.body;
    for (const i of path) {
      el = el?.children?.[i];
    }
    if (!el || el === doc.body) return html;

    if (targetScreenId) {
      el.setAttribute("data-nav", targetScreenId);
      if (transition) {
        el.setAttribute("data-transition", transition);
      }
    } else {
      el.removeAttribute("data-nav");
      el.removeAttribute("data-transition");
    }
    return doc.body.innerHTML.trim();
  } catch (err) {
    console.warn("setElementNavigation failed:", err);
    return html;
  }
}
